using System;
using System.IO;
using System.Management.Automation;
using System.Management.Automation.Runspaces;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    private const string WindowTitle = "Open code CLI 中文注入";

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string className, string title);

    [DllImport("user32.dll")]
    private static extern bool ShowWindowAsync(IntPtr window, int command);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [STAThread]
    private static int Main(string[] args)
    {
        bool ownsMutex = false;
        string user = WindowsIdentity.GetCurrent().User.Value;
        using (var mutex = new Mutex(false, @"Local\OpenCodeChineseTool-" + user))
        {
            try
            {
                try { ownsMutex = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { ownsMutex = true; }

                if (!ownsMutex)
                {
                    IntPtr existing = FindWindow(null, WindowTitle);
                    if (existing != IntPtr.Zero)
                    {
                        ShowWindowAsync(existing, 9);
                        SetForegroundWindow(existing);
                    }
                    else
                    {
                        MessageBox.Show("工具正在启动，请稍候。", WindowTitle,
                            MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    return 0;
                }

                string script = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tool.ps1");
                if (!File.Exists(script))
                    throw new FileNotFoundException("找不到 tool.ps1，请将启动工具和其他文件放在同一目录。", script);

                var state = InitialSessionState.CreateDefault();
                state.ExecutionPolicy = Microsoft.PowerShell.ExecutionPolicy.Bypass;
                using (var runspace = RunspaceFactory.CreateRunspace(state))
                {
                    runspace.ApartmentState = ApartmentState.STA;
                    runspace.ThreadOptions = PSThreadOptions.UseCurrentThread;
                    runspace.Open();
                    using (var command = PowerShell.Create())
                    {
                        command.Runspace = runspace;
                        command.AddCommand(script);
                        if (args.Length >= 2 && args[0] == "--ui-smoke")
                        {
                            command.AddParameter("UiSmokeTest", args[1]);
                            if (args.Length == 3) command.AddParameter("TargetPath", args[2]);
                        }
                        command.Invoke();
                        if (command.InvocationStateInfo.State == PSInvocationState.Failed)
                            throw new InvalidOperationException("工具窗口启动失败。",
                                command.InvocationStateInfo.Reason);
                    }
                }
                return 0;
            }
            catch (Exception error)
            {
                string details = error.ToString();
                try
                {
                    string directory = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                        "OpencodeChinesePortable", "logs");
                    Directory.CreateDirectory(directory);
                    File.AppendAllText(Path.Combine(directory, "launcher.log"),
                        DateTime.Now.ToString("s") + Environment.NewLine + details +
                        Environment.NewLine, Encoding.UTF8);
                }
                catch { }
                MessageBox.Show(details, WindowTitle + " · 启动失败",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            finally
            {
                if (ownsMutex) mutex.ReleaseMutex();
            }
        }
    }
}
