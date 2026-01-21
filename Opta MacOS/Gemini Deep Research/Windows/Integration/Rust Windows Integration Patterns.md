# **Architectural Patterns for Native Windows Integration in High-Fidelity Rust Applications**

## **Executive Summary**

The contemporary Windows application landscape demands a rigorous adherence to platform-specific integration patterns to achieve a "premium" user experience. While cross-platform abstractions provide rapid development velocities, they frequently fail to leverage the deep OS capabilities that distinguish a native application from a generic port. For systems programming languages like Rust, which offer memory safety without the overhead of a managed runtime, the opportunity exists to interface directly with the Windows API—spanning the legacy Win32 subsystems, the Component Object Model (COM), and the modern Windows Runtime (WinRT)—to deliver high-performance, deeply integrated desktop solutions.

This report articulates the architectural requirements for creating a high-fidelity Rust application on Windows. It moves beyond basic windowing to explore the sophisticated state management required for Taskbar interactivity, the complex lifecycle of Modern Standby (S0 Low Power Idle), the cryptographic assurances of the Data Protection API (DPAPI) and Windows Hello, and the hybrid identity models required to access the Share Target contract from an unpackaged executable. By synthesizing these patterns, developers can engineer applications that respect system resources, communicate state effectively through shell extensions, and adhere to the rigorous security models of the modern Windows NT kernel.

## ---

**1\. Advanced Desktop Shell Integration**

The Windows Desktop Shell (Explorer) serves as the primary orchestration layer for user activity. A premium application must project its internal state onto this surface, utilizing the Taskbar not merely as a launcher, but as a dynamic status monitor and command interface.

### **1.1 Taskbar State and Progress Indication (ITaskbarList3)**

The ITaskbarList3 interface is the cornerstone of taskbar interactivity. It allows an application to transform its taskbar button into a progress gauge, providing critical feedback for long-running operations such as compilation, file transfer, or rendering, without requiring the application window to hold focus.

#### **1.1.1 COM Apartment Models and Rust**

Interaction with ITaskbarList3 is predicated on the Component Object Model (COM). In Rust, this necessitates a deliberate management of thread apartments. The Windows shell APIs predominantly require the Single-Threaded Apartment (STA) model. A Rust application, particularly one using asynchronous runtimes like tokio which utilize a pool of worker threads, must ensure that COM interactions occur on a thread explicitly initialized with CoInitializeEx(NULL, COINIT\_APARTMENTTHREADED).1

Failure to adhere to this threading model results in RPC\_E\_CHANGED\_MODE errors or silent failures where the taskbar button does not update. The windows crate in Rust handles the projection of these interfaces, but the developer acts as the guardian of the thread context. The standard pattern involves creating a dedicated UI thread or utilizing the message pump thread of the main window to marshal these calls.

#### **1.1.2 Progress State Semantics**

The visual language of the taskbar progress indicator is defined by the SetProgressState method, which accepts flags that convey the *health* of the operation, not just its completion.

* **TBPF\_NORMAL (Green)**: Represents a healthy, active operation.  
* **TBPF\_ERROR (Red)**: Indicates a stalled or failed process. A premium application uses this state to signal user intervention is required (e.g., "Disk Full" or "Network Timeout").3  
* **TBPF\_PAUSED (Yellow)**: Signals that the operation is suspended, either by user action or environmental constraint (e.g., pausing a download due to metered network detection).  
* **TBPF\_INDETERMINATE (Marquee)**: A pulsing animation used during initialization phases where the total work volume is yet to be calculated.

When implementing SetProgressValue(hwnd, ullCompleted, ullTotal), Rust developers must bridge the gap between high-precision internal metrics (often f64 or usize) and the ULONGLONG requirements of the API. A critical optimization pattern is **Update Throttling**. The Windows Shell communicates with the Desktop Window Manager (DWM) to render these overlays. Emitting progress updates at the frequency of a tight loop (e.g., every file copied in a million-file batch) saturates the window message queue (specifically WM\_USER messages typically used for dispatch) and causes the Explorer process to become unresponsive. A "premium" implementation includes a debounce layer, committing updates to the COM interface only when the percentage changes by a visible increment (e.g., 1%) or a temporal threshold (e.g., 250ms) is crossed.1

#### **1.1.3 Thumbnail Toolbars**

The ITaskbarList3::ThumbBarAddButtons method allows the injection of up to seven interactive buttons into the application's hover preview. This interface is immutable regarding the *number* of buttons once initialized for a window handle; however, the state (hidden, disabled, interactive) and imagery of these buttons can be updated dynamically.

In Rust, the THUMBBUTTON structure requires strict adherence to C-ABI layout compatibility (\#\[repr(C)\]). The interaction model differs from standard UI controls: buttons trigger a WM\_COMMAND message to the host window where the high word of wParam corresponds to THBN\_CLICKED. The Rust window procedure (WndProc) must explicitly route these specific messages to application logic.1 This pattern effectively turns the thumbnail into a remote control, essential for media applications or background workers where bringing the main window to the foreground breaks user flow.

### **1.2 The Transactional Model of Jump Lists (ICustomDestinationList)**

Jump Lists provide a mechanism to expose "Recent" files and "Frequent" tasks directly from the Start Menu or Taskbar context menu. While Windows manages the "Recent" category automatically for registered file types, the ICustomDestinationList interface allows for the curation of "Custom Categories" (e.g., "Pinned Projects" or "Quick Actions").

#### **1.2.1 Transactional Integrity**

Unlike most UI updates which are immediate, Jump List updates are transactional. The cycle is defined by BeginList, followed by content addition, and finalized by CommitList.5

1. **Initiation (BeginList)**: This method returns an IObjectArray containing items the user has *removed*.  
2. **User Agency Enforcement**: It is a violation of the Windows User Experience Guidelines, and a programmatic failure condition, to re-add an item that appears in the removed list. The Rust implementation must iterate this array, hashing the items, and filtering them out of the pending update. Failure to respect this removal list will cause the CommitList call to fail, resulting in a stale Jump List.5  
3. **Commitment**: Only upon CommitList does the shell update the UI.

This transactional model protects the shell database from corruption and ensures user customizations (removals) are respected. The underlying storage for these lists is located in %APPDATA%\\Microsoft\\Windows\\Recent\\CustomDestinations 6, utilizing the Compound File Binary Format (CFBF). While direct parsing of these files is possible via crates like jumplist\_parser 6, writing to them should strictly occur via the COM interface to ensure synchronization with the Start Menu process.

#### **1.2.2 The AppUserModelID (AUMID) Dependency**

A frequent integration failure in Rust applications is the fragmentation of Jump Lists due to inconsistent Application User Model IDs (AUMID). If an application does not explicitly set an AUMID via SetCurrentProcessExplicitAppUserModelID at startup, Windows generates one heuristically based on the executable path. This heuristic breaks if the application is pinned via a shortcut that has a set AUMID, or if the application is launched via a protocol handler.

To ensure that the Jump List, Taskbar Icon, and Toast Notifications all attribute to the same logical entity, a premium Rust application must define a canonical AUMID (e.g., Vendor.Application.Module) and apply it consistently to:

1. The Process (via shell32.dll).  
2. The Window (via SHGetPropertyStoreForWindow and PKEY\_AppUserModel\_ID).  
3. Any Shortcuts created during installation (IShellLink::SetAppUserModelID).

## ---

**2\. The Windows Notification Pipeline**

The transition from "Balloon Tips" to "Toast Notifications" represents a shift from transient, passive information to persistent, actionable alerts stored in the Action Center. Integrating the ToastNotificationManager in Rust involves bridging the WinRT XML-based payload system with the COM-based activation logic.

### **2.1 XML Payload Construction and Binding**

Toast content is defined strictly via XML, a departure from the struct-based configuration of Shell\_NotifyIcon. The schema supports rich media, including "Hero" images, progress bars, and attribution text.

#### **2.1.1 Advanced Visual Binding**

Rust applications interact with this schema by constructing XML strings or using the DOM manipulation methods of Windows.Data.Xml.Dom.

* **Hero Images**: The \<image placement="hero" src="..."/\> element creates a prominent banner.  
* **Data Binding**: Premium applications utilize data binding (\<binding template="ToastGeneric"\>) to separate layout from content, allowing for localization and dynamic updates to existing toasts (e.g., updating a progress bar in a notification without spawning a new one).7

For Rust applications distributed outside the Microsoft Store (unpackaged), image references in the XML (src) must use valid protocols. While http:// is supported for apps with internet capability, local images must be referenced via file:///. The application must ensure the image file is accessible to the notification service process; transient files in a temp folder are a common source of broken images if they are deleted before the toast is displayed.

### **2.2 Interactive Toasts and Background Activation**

The distinction between a standard and premium integration lies in interactivity. Toasts can contain inputs (text boxes) and actions (buttons).

#### **2.2.1 Activation Types**

The \<action\> element's activationType attribute dictates the architectural requirement:

* **Protocol (Foreground)**: The default. Clicking the button launches the app via its URI scheme. This is simple but intrusive, forcing the app to the foreground to handle a simple interaction like "Mark as Read."  
* **Background**: Clicking the button spawns a background task. For Win32 Rust apps, this requires implementing a **COM Server**.

#### **2.2.2 The COM Server Requirement**

To support background activation (handling an action without a window), the Rust application must implement the INotificationActivationCallback interface. This involves:

1. **Class Factory**: Exposing an IClassFactory that creates instances of the notification handler.  
2. **Registry Registration**: Registering a CLSID in HKCU\\Software\\Classes\\CLSID with a LocalServer32 key pointing to the executable.  
3. **Command Line Routing**: When the Notification Service invokes the CLSID, it launches the executable with a specific embedding flag. The Rust main function must detect this flag, initialize COM, register the class object, and wait for the Activate callback, rather than launching the GUI.9

This pattern allows users to reply to messages or dismiss reminders directly from the Action Center, a hallmark of a native, high-fidelity experience.

## ---

**3\. System Tray and Context Menu Architecture**

The System Tray (Notification Area) is the domain of long-running services. While seemingly simple, the Shell\_NotifyIcon API contains several historical quirks that require rigorous handling to avoid "ghost" icons or unresponsive menus.

### **3.1 The Spy Window Pattern**

The Shell\_NotifyIcon API communicates events via the Windows Message Queue. It requires an HWND to receive these messages. Premium Rust applications, which may close their main window while remaining active in the tray, employ the "Spy Window" (or Message-Only Window) pattern.

This involves creating a window using CreateWindowExW with the HWND\_MESSAGE parent constant (value \-3). This window is invisible, has no Z-order, and does not appear in the taskbar, yet it possesses a message queue capable of processing the callback messages defined in the NOTIFYICONDATA structure (e.g., WM\_USER \+ 1).10

### **3.2 The Focus Trap and Menu Logic**

A critical implementation detail in tray context menus is the "Focus Trap." If a user right-clicks the tray icon, the menu appears. If they then click *outside* the menu (e.g., on the desktop), the menu *should* disappear. However, without specific handling, the menu will persist (stick) because the hidden window does not have focus.

The mandatory sequence for the Rust message handler is:

1. **SetForegroundWindow(hwnd)**: Force the OS to treat the hidden window as the foreground target.  
2. **TrackPopupMenu**: Display the menu modally.  
3. **PostMessage(WM\_NULL)**: Immediately post a benign message to the loop. This forces the message pump to process the next event, allowing the menu to close correctly when focus is lost.11

### **3.3 High-DPI and Icon Management**

Premium applications must handle DPI changes dynamically. The Shell\_NotifyIcon API supports NIF\_GUID, allowing the icon to be identified by a GUID rather than a numeric ID. This prevents icon scrambling if the explorer process crashes and restarts (a "TaskbarCreated" registered message must be handled to re-add the icon). Furthermore, providing high-resolution .ico resources is essential; standard 16x16 icons will appear blurry on 4k displays with 200% scaling. Rust's resource embedding capabilities should be used to include multi-resolution icon groups.

## ---

**4\. Windows Search Integration (ISearchFolderItemFactory)**

Deep integration involves making application content discoverable via the native Explorer interface. The ISearchFolderItemFactory interface allows applications to create "Virtual Search Folders"—dynamic views that present query results as file system locations.

### **4.1 Constructing Virtual Views**

This interface enables the creation of an IShellItem that represents a query rather than a directory.

1. **Scope Definition**: Using SetScope, the application restricts the search to specific known folders or libraries (e.g., only the user's "Documents").  
2. **Condition Parsing**: The SetCondition method accepts an ICondition tree. While simple queries can be constructed via Advanced Query Syntax (AQS) strings (e.g., kind:picture AND tag:vacation), premium applications should construct the condition tree programmatically using the ConditionFactory APIs to avoid syntax errors and injection vulnerabilities.12

### **4.2 Application Scenarios**

This pattern is particularly powerful for Rust-based asset management tools or data analysis applications. Instead of building a custom file browser UI, the app can generate a Virtual Search Folder and open it via SHOpenFolderAndSelectItems. This presents the user with a standard Explorer window populated with the filtered results, supporting full shell context menus, drag-and-drop, and view modes, at zero development cost for the UI itself.

## ---

**5\. Contracts, Associations, and Identity**

A premium application must "own" its data types. This requires registering as the default handler for files and URIs. Modern Windows security models partition these capabilities based on Package Identity.

### **5.1 Protocol Handlers and Argument Parsing**

Registering a custom URI scheme (e.g., myapp://) is essential for inter-app communication and OAuth flows.

* **Registry Topology**: The key HKCR\\myapp must contain a URL Protocol string value. The command key HKCR\\myapp\\shell\\open\\command defines the invocation.  
* **Security Insight**: The invocation string is typically "C:\\Path\\App.exe" "%1". The %1 token expands to the full, unescaped URI. A naive implementation that passes this string to a shell interpreter (like cmd.exe) introduces a Remote Code Execution (RCE) vulnerability. Rust's std::process::Command mitigates this by treating arguments as data, but developers must ensure the main function parses the URI strictly, handling URL-decoding and validating the host/path components.14

### **5.2 The Share Target Contract and Sparse Packages**

The "Share" contract allows an app to receive content from the system share sheet. Historically, this was restricted to UWP apps. For a standard Win32 Rust application to participate, it must adopt **Package Identity** via a **Sparse Package**.16

#### **5.2.1 The Sparse Package Architecture**

A Sparse Package is an MSIX package that contains only a manifest (AppxManifest.xml) and assets (icons), but *not* the application binary. It acts as a "pointer" to the existing executable on disk.

1. **Manifest Definition**: The manifest declares the \<Identity\>, \<uap:VisualElements\>, and the critical \<uap:ShareTarget\> extension.  
2. **Packaging**: The MakeAppx.exe tool is used with the /nv (no validation) switch to pack this manifest.  
3. **Registration**: The Rust application (or its installer) calls PackageManager.RegisterPackageByUriAsync, passing the URI of the .msix and the ExternalLocationURI pointing to the folder containing the .exe.

#### **5.2.2 Identity Activation**

Once registered, the application is viewed by the OS as "Packaged." When a user shares a file to the app, the OS does not merely launch the executable with arguments; it triggers a ShareTarget Activation.  
The Rust application must check AppInstance::GetActivatedEventArgs() at startup. If the activation kind is ShareTarget, the app must:

1. Retrieve the ShareOperation object.  
2. Call ShareOperation.Data.GetStorageItemsAsync() to receive the files.  
3. Call ShareOperation.ReportCompleted() to signal the UI to close.

This workflow is fundamentally different from command-line argument processing and requires the windows crate to interact with the WinRT Windows.ApplicationModel.DataTransfer namespace.18

## ---

**6\. Security Integration: Biometrics and Secrets**

Storing credentials in plaintext files is a vulnerability incompatible with premium status. Integration with the Windows security subsystems is mandatory.

### **6.1 Windows Hello and UserConsentVerifier**

The UserConsentVerifier WinRT API allows applications to gate access to sensitive functions using the user's PIN, Face, or Fingerprint, without handling the biometric data itself.

* **Availability**: The app must first call UserConsentVerifier::CheckAvailabilityAsync. If the return is DeviceNotPresent or DisabledByPolicy, the UI should degrade gracefully (e.g., falling back to a password prompt).  
* **The Verification Flow**: Calling RequestVerificationAsync("Please confirm to reveal API Key") triggers the secure desktop dimming and system modal prompt.  
* **Thread Context**: As a UI-modal operation, this call must be made from a thread that does not block the UI pump, yet respects the COM apartment rules. In Rust async contexts, this often requires spawning the call onto a dedicated worker thread to avoid deadlocking the main event loop.20

### **6.2 Credential Manager (CredWrite / CredRead)**

For persistent storage of OAuth tokens or passwords, the Windows Credential Manager acts as a secure vault.

* **Isolation**: Credentials stored here are roaming-capable and encrypted.  
* **Implementation**: The CredWriteW function takes a CREDENTIAL struct. The TargetName serves as the primary key.  
* **Memory Safety**: CredReadW allocates memory for the returned credential using LocalAlloc. A Rust wrapper must implement the Drop trait to ensure CredFree is called, preventing memory leaks which are critical in long-running desktop processes.22

### **6.3 Data Protection API (DPAPI)**

For local data (e.g., encrypting a local SQLite database file), DPAPI (CryptProtectData) is the standard. It uses the user's login credentials to derive a symmetric key.

* **Entropy**: The pOptionalEntropy parameter is crucial. Without it, any application running as the user can decrypt the data. A premium application generates a unique, app-specific entropy (salt) and passes it to CryptProtectData. This ensures that even if a malicious script runs as the user, it cannot decrypt the application's data without also knowing the specific entropy value used by the Rust application.23

## ---

**7\. Power and Thermal Engineering**

A high-fidelity application respects the physical constraints of the hardware. It must adapt to battery state, thermal throttling, and modern sleep paradigms.

### **7.1 Modern Standby (S0 Low Power Idle)**

Modern Windows devices (Surface, Ultrabooks) do not use the traditional S3 sleep state where processes are frozen. They use S0 Low Power Idle, where the system remains partially active.  
The Risk: If a Rust application maintains an active timer (e.g., SetTimer or a tokio interval) or an open network socket, it can prevent the CPU from entering the Deepest Runtime Idle Platform State (DRIPS). This causes "hot bagging"—the laptop overheats and drains battery while "asleep."  
**The Mitigation**:

1. **Registration**: Use PowerRegisterSuspendResumeNotification with DEVICE\_NOTIFY\_CALLBACK.  
2. **Handling Suspend**: Upon receiving the suspend notification, the app must immediately:  
   * Stop all animation loops.  
   * Close non-essential network handles.  
   * Flush file buffers to disk.  
3. **Handling Resume**: Re-initialize resources only when the user returns.

This behavior is enforced by the **Desktop Activity Moderator (DAM)**. If an app ignores these signals, the DAM may terminate it to preserve battery life.

### **7.2 Thermal Throttling Detection**

A premium app monitors the system's thermal health. If the CPU is throttling, the app should voluntarily reduce its workload (e.g., reducing video decode quality or pausing background indexing).

* **Detection Method**: The most reliable method is CallNtPowerInformation with ProcessorPowerInformation.  
* **The Heuristic**: This function returns a struct containing MaxMhz and CurrentMhz. If CurrentMhz \< MaxMhz while the CPU load is high, thermal or power delivery throttling is active.25  
* **Rust Implementation**: The PROCESSOR\_POWER\_INFORMATION struct definition is frequently missing from standard headers. Rust developers must manually define this struct \#\[repr(C)\] to interface with powrprof.dll correctly.27

### **7.3 Power Source Awareness**

Using RegisterPowerSettingNotification, the app listens for GUID\_ACDC\_POWER\_SOURCE.

* **On Battery**: The app should switch to an "Eco Mode"—batching network requests, disabling translucent aesthetic effects (Mica/Acrylic), and reducing background sync intervals.  
* **Monitor State**: Listening for GUID\_MONITOR\_POWER\_ON allows the app to pause rendering completely when the screen turns off, saving significant GPU power.28

## ---

**8\. Rust Integration Specifics: The windows vs. winapi Ecosystem**

The Rust ecosystem offers two primary paths for these integrations: winapi (legacy, raw C-types) and windows (modern, Microsoft-supported, object-oriented).

### **8.1 The Case for the windows Crate**

For premium integration, the windows crate is superior due to its handling of COM and WinRT.

* **HRESULT Handling**: It automatically projects failing HRESULTs into Rust Result types, preventing the common error of ignoring return codes in C-style APIs.  
* **String Projections**: It handles the conversion between Rust \&str and Windows HSTRING or PCWSTR (UTF-16), reducing the risk of buffer overflows or encoding errors.  
* **WinRT Safety**: It correctly manages the reference counting (AddRef/Release) of COM/WinRT objects via the Drop trait, ensuring that resources like ITaskbarList3 or ToastNotification are cleaned up deterministically.

### **8.2 Unsafe Blocks and Soundness**

Despite the safe wrappers, deep integration often requires unsafe blocks, particularly for:

* **FFI Callbacks**: Window procedures (WndProc) and hook callbacks must be extern "system". Panic unwinding across these FFI boundaries is undefined behavior (UB) and will crash the process. Premium Rust apps use std::panic::catch\_unwind at every FFI boundary to ensure stability.  
* **Pointer Casting**: Interactions with LPARAM and WPARAM often involve casting pointers to structs (e.g., NOTIFYICONDATA). Strict validation of these pointers is required before dereferencing.

## ---

**Conclusion**

The development of a premium Rust desktop application on Windows is a discipline of deep OS integration. It requires moving beyond the visual layer to participate in the system's lifecycle, security, and shell contracts. By implementing ITaskbarList3 for state communication, adopting the Sparse Package model to bridge the Win32-UWP divide for Share contracts, securing data via DPAPI and Hello, and respecting the rigorous power topology of Modern Standby, developers can deliver applications that are indistinguishable from first-party Windows components. The result is software that is not only memory-safe and performant—traits inherent to Rust—but also deeply native, respectful of the user's resources, and fully integrated into the modern Windows workflow.

## **Appendix: Comparison of Key Integration APIs**

| Feature Domain | Legacy API (Avoid) | Modern API (Adopt) | Rust Crate Recommendation |
| :---- | :---- | :---- | :---- |
| **Notifications** | Balloon Tips (NIF\_INFO) | ToastNotificationManager | windows (WinRT) |
| **Taskbar** | FlashWindowEx | ITaskbarList3 | windows (COM) |
| **File Identity** | Registry Associations | Sparse Package (Manifest) | windows \+ Custom Manifest |
| **Encryption** | Custom XOR/AES | CryptProtectData (DPAPI) | winapi (C-ABI) |
| **Throttling** | GlobalMemoryStatus | CallNtPowerInformation | winapi (Manual Struct) |
| **Sleep** | WM\_POWERBROADCAST | PowerRegisterSuspend... | winapi |
| **Search** | File System Crawl | ISearchFolderItemFactory | windows (COM) |

#### **Works cited**

1. ITaskbarList3::SetProgressValue (shobjidl\_core.h) \- Win32 apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/api/shobjidl\_core/nf-shobjidl\_core-itaskbarlist3-setprogressvalue](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-setprogressvalue)  
2. ITaskbarList3 in winsafe \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/winsafe/latest/winsafe/struct.ITaskbarList3.html](https://docs.rs/winsafe/latest/winsafe/struct.ITaskbarList3.html)  
3. How to show progress in taskbar button? \- windows \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/61707140/how-to-show-progress-in-taskbar-button](https://stackoverflow.com/questions/61707140/how-to-show-progress-in-taskbar-button)  
4. New crate to draw a progress bar in your app taskbar button : r/rust \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/pesg6n/new\_crate\_to\_draw\_a\_progress\_bar\_in\_your\_app/](https://www.reddit.com/r/rust/comments/pesg6n/new_crate_to_draw_a_progress_bar_in_your_app/)  
5. WindowsSDK7-Samples/winui/shell/appshellintegration/CustomJumpList/CustomJumpListSample.cpp at master \- GitHub, accessed January 20, 2026, [https://github.com/pauldotknopf/WindowsSDK7-Samples/blob/master/winui/shell/appshellintegration/CustomJumpList/CustomJumpListSample.cpp](https://github.com/pauldotknopf/WindowsSDK7-Samples/blob/master/winui/shell/appshellintegration/CustomJumpList/CustomJumpListSample.cpp)  
6. jumplist\_parser \- crates.io: Rust Package Registry, accessed January 20, 2026, [https://crates.io/crates/jumplist\_parser](https://crates.io/crates/jumplist_parser)  
7. ToastNotificationManager Class (Windows.UI.Notifications) \- Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/uwp/api/windows.ui.notifications.toastnotificationmanager?view=winrt-26100](https://learn.microsoft.com/en-us/uwp/api/windows.ui.notifications.toastnotificationmanager?view=winrt-26100)  
8. Toast notification's parameters with XML \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/64817746/toast-notifications-parameters-with-xml](https://stackoverflow.com/questions/64817746/toast-notifications-parameters-with-xml)  
9. Windows devs, we've got a new package : r/rust \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/1gi17pa/windows\_devs\_weve\_got\_a\_new\_package/](https://www.reddit.com/r/rust/comments/1gi17pa/windows_devs_weve_got_a_new_package/)  
10. systray-util \- Windows APIs \- Lib.rs, accessed January 20, 2026, [https://lib.rs/crates/systray-util](https://lib.rs/crates/systray-util)  
11. Creating system tray right click menu C++ \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/68474486/creating-system-tray-right-click-menu-c](https://stackoverflow.com/questions/68474486/creating-system-tray-right-click-menu-c)  
12. win32/desktop-src/shell/samples-searchfolder.md at docs \- GitHub, accessed January 20, 2026, [https://github.com/MicrosoftDocs/win32/blob/docs/desktop-src/shell/samples-searchfolder.md](https://github.com/MicrosoftDocs/win32/blob/docs/desktop-src/shell/samples-searchfolder.md)  
13. shell \- Wildcards and IShellFolder enumeration? \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/56535800/wildcards-and-ishellfolder-enumeration](https://stackoverflow.com/questions/56535800/wildcards-and-ishellfolder-enumeration)  
14. sysuri \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/sysuri](https://docs.rs/sysuri)  
15. How do I register a custom URL protocol in Windows? \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/80650/how-do-i-register-a-custom-url-protocol-in-windows](https://stackoverflow.com/questions/80650/how-do-i-register-a-custom-url-protocol-in-windows)  
16. Packaging overview \- Windows apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/packaging/](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/packaging/)  
17. Unpackaged Windows Apps with Identity using a Sparse Package \- Nick's .NET Travels, accessed January 20, 2026, [https://nicksnettravels.builttoroam.com/sparse-package/](https://nicksnettravels.builttoroam.com/sparse-package/)  
18. ShareTargetActivatedEventArgs Class (Windows.ApplicationModel.Activation) \- Windows apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.activation.sharetargetactivatedeventargs?view=winrt-26100](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.activation.sharetargetactivatedeventargs?view=winrt-26100)  
19. Integrate unpackaged apps with Windows Share \- Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/apps/develop/windows-integration/integrate-sharesheet-unpackaged](https://learn.microsoft.com/en-us/windows/apps/develop/windows-integration/integrate-sharesheet-unpackaged)  
20. How to use \`IUserConsentVerifierInterop\` · Issue \#1565 · microsoft/windows-rs \- GitHub, accessed January 20, 2026, [https://github.com/microsoft/windows-rs/issues/1565](https://github.com/microsoft/windows-rs/issues/1565)  
21. Add Windows biometric authentication support using Windows Hello · Issue \#2 · azu/confirm-pam \- GitHub, accessed January 20, 2026, [https://github.com/azu/confirm-pam/issues/2](https://github.com/azu/confirm-pam/issues/2)  
22. How to map Windows API CredWrite/CredRead in JNA? \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/38404517/how-to-map-windows-api-credwrite-credread-in-jna](https://stackoverflow.com/questions/38404517/how-to-map-windows-api-credwrite-credread-in-jna)  
23. CryptProtectData function (dpapi.h) \- Win32 apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata)  
24. Windows \- Data Protection API (DPAPI) \- Tier Zero Security, accessed January 20, 2026, [https://tierzerosecurity.co.nz/2024/01/22/data-protection-windows-api.html](https://tierzerosecurity.co.nz/2024/01/22/data-protection-windows-api.html)  
25. CallNtPowerInformation function (powerbase.h) \- Win32 apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/api/powerbase/nf-powerbase-callntpowerinformation](https://learn.microsoft.com/en-us/windows/win32/api/powerbase/nf-powerbase-callntpowerinformation)  
26. CallNtPowerInformation/CallNtPowerInformation/main.cpp at master · erenpinaz/CallNtPowerInformation \- GitHub, accessed January 20, 2026, [https://github.com/erenpinaz/CallNtPowerInformation/blob/master/CallNtPowerInformation/main.cpp](https://github.com/erenpinaz/CallNtPowerInformation/blob/master/CallNtPowerInformation/main.cpp)  
27. Getting ProcessorInformation from CallNtPowerInformation() \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/76030647/getting-processorinformation-from-callntpowerinformation](https://stackoverflow.com/questions/76030647/getting-processorinformation-from-callntpowerinformation)  
28. Programmatically detect whether a display is attached to the computer or not \- Super User, accessed January 20, 2026, [https://superuser.com/questions/1808981/programmatically-detect-whether-a-display-is-attached-to-the-computer-or-not](https://superuser.com/questions/1808981/programmatically-detect-whether-a-display-is-attached-to-the-computer-or-not)