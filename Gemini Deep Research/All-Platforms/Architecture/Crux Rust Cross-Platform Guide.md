# **Architectural Blueprint for the Migration of Opta to the Crux Framework**

## **1\. Executive Summary: The Paradigm of the Humble View**

The migration of the "Opta" application from a React-based architecture to a Rust-centric Core utilizing the Crux framework represents a foundational shift in software design, moving from an imperative, platform-dependent state management model to a functional, cross-platform, and strictly event-driven architecture. Crux, developed by Red Badger, operationalizes the "Headless" or "Humble View" architecture by strictly separating behavioral logic (the Core) from side effects and user interface rendering (the Shell).1 This architectural decoupling addresses the "bus factor" inherent in maintaining duplicate business logic across iOS and Android while avoiding the "uncanny valley" of non-native UI rendering often associated with frameworks like React Native or Flutter.

The decision to adopt Crux implies a commitment to the Elm Architecture, treating the application as a pure function of (Model, Event) \-\> (Model, Effect).3 This ensures that the core logic is deterministic, free of race conditions, and testable in milliseconds without the overhead of platform emulators.2 For Opta, this transition moves complexity from the fragile, ephemeral UI layer into a robust, type-safe Rust core, ensuring that business rules are consistent, verified, and platform-agnostic.4

This report serves as an exhaustive guide for this migration. It details the internal mechanics of the Crux runtime, the integration patterns for native shells, and the strategic roadmap for porting legacy React state to a Rust-based Event Sourcing model. The analysis confirms that while the initial setup of the Foreign Function Interface (FFI) boundary requires significant architectural discipline, the resulting system provides a level of correctness and maintainability that is mathematically guaranteed by the Rust type system.

## **2\. Core Architecture: The Functional Heart**

The Crux Core serves as the portable "brain" of the Opta application. It dictates *what* should happen, but never *how* it happens. It is strictly "driven," meaning it possesses no internal event loop or autonomous agency; it only advances when the Shell injects an event.3 This inversion of control is critical for maintaining portability, as it ensures the Core makes no assumptions about the environment in which it executes, whether that be a high-performance iOS device, a fragmented Android ecosystem, or a WebAssembly sandbox in a browser.

### **2.1 The App, Model, Event, Effect Pattern**

The structural foundation of a Crux application is defined by the App trait, which enforces the four pillars of the Elm Architecture within Rust's static type system.1 Implementing this trait transforms a static struct into a dynamic state machine capable of processing messages and emitting intents.

#### **2.1.1 The App Trait Configuration**

The App trait acts as the semantic boundary of the Core. It binds the associated types—Event, Model, ViewModel—and the capability requirements (Capabilities) into a cohesive unit. This trait demands the implementation of a pure update function and a view projection function. The rigorous enforcement of these types ensures that all possible state transitions are defined at compile time, eliminating the class of runtime errors common in JavaScript-based architectures where state shapes may mutate unpredictably.

#### **2.1.2 The Model: Single Source of Truth**

The Model represents the persistent internal state of the application. Unlike React’s fragmented useState hooks or Redux’s often loosely typed stores, the Crux Model is a comprehensive struct that must represent every possible valid state of the business logic.7 Ideally, illegal states should be unrepresentable in the Model through the use of Rust's enums and algebraic data types.

For the Opta migration, this requires consolidating disparate React contexts and hooks into a unified Rust struct. This model is never exposed directly to the Shell to prevent accidental mutation or tight coupling. Instead, the Shell receives a ViewModel, which is a sanitized, UI-specific projection of the Model. This separation allows the internal domain representation to evolve independently of the view layer.

#### **2.1.3 The Event: Describing the World**

Event is an enumeration that lists every possible external stimulus the Core can receive. In a functional architecture, events are treated as data, not code. They describe "what happened" (e.g., UserLoggedIn, DataFetched) rather than "what to do" (e.g., FetchData, NavigateHome). This distinction is vital for decoupling; the Shell simply reports occurrences, and the Core decides the response.2

Events in Opta will generally fall into three categories:

1. **User Interactions:** Explicit actions taken by the user, such as ClickedLogin or TypedUsername(String).  
2. **System Events:** Environmental triggers like TimeTick or NetworkStatusChanged.  
3. **Capability Responses:** Data returning from asynchronous operations, such as HttpResult(Result\<Response, Error\>).

#### **2.1.4 The Effect and Command: Declarative Outputs**

When the update function processes an event, it returns a Command. A Command is a declarative instruction to the Shell to perform side effects. It wraps one or more Effects. The Effect type is an enum, typically generated by the \#\[effect\] macro, which aggregates all operations exposed by the registered capabilities into a single variant that can be serialized and sent over the FFI boundary.7

This pattern ensures that the Core remains side-effect free. It does not open sockets or touch the file system; it merely constructs a data packet (the Effect) that describes the intent to do so. This architectural choice is what allows the Core to be tested in isolation without mocks.

### **2.2 Capabilities: The Managed Effects System**

Capabilities act as the bridge between the pure Core and the impure Shell. They provide ergonomic APIs for requesting side effects while maintaining the strict separation of intent and execution.3

#### **2.2.1 Anatomy of a Capability**

A Capability in Crux is composed of three distinct layers of abstraction:

1. **The Operation:** A serializable data structure describing the request (e.g., HttpRequest). This is the raw data payload sent to the Shell.  
2. **The Effect Variant:** The enum variant wrapping the operation (e.g., Effect::Http(HttpRequest)). This allows the Shell to switch on the variant type to determine which handler to invoke.  
3. **The Client API:** The methods exposed to the update function (e.g., caps.http.get(...)). When the Core calls this API, it does not execute the operation immediately. Instead, it queues the Operation in the Crux runtime, which eventually yields it to the Shell as a Request.8

#### **2.2.2 Standard Capabilities Breakdown**

Crux provides a suite of standard capabilities that cover most application needs.

* **Render:** This is the most fundamental capability. It sends a signal to the Shell indicating that the Model has changed and the Shell should request a new ViewModel via the view() function. It typically carries no payload, acting merely as a synchronization pulse.9  
* **Http:** The HTTP capability is a wrapper around the surf API concepts but implemented strictly as data types. It allows the Core to construct complex requests (headers, bodies, methods) without access to a network stack. The response is fed back into the Core as a new Event.11  
* **KeyValue:** This capability provides basic CRUD operations (read, write, delete) for persistent storage. It abstracts over platform-specific implementations like UserDefaults on iOS or SharedPreferences on Android, allowing the Core to persist state without knowledge of the file system.12

### **2.3 Side Effect Handling and the "Driven" Core**

The "driven" nature of Crux is its most distinct architectural feature. The Core is a passive library that does not run a background thread or an event loop. The execution cycle is strictly synchronous from the Core's perspective regarding state updates, but asynchronous regarding effect resolution.

The cycle proceeds as follows:

1. **Driving Side:** The Shell detects a UI event (e.g., a button press) and calls the Core's process\_event.  
2. **Processing:** The Core runs the pure update function, mutating the Model and generating a Command.  
3. **Driven Side:** The Core returns a list of Request objects (effects) to the Shell.  
4. **Execution:** The Shell performs the requested work (e.g., makes an API call).  
5. **Resolution:** Upon completion, the Shell calls handle\_response or resolve on the Core, passing the result back, which triggers a new update cycle.2

### **2.4 Testing the Core in Isolation**

One of the primary benefits of the Crux architecture is the ability to test complex business logic without integrated testing environments. Because the Core is pure and effects are data, tests can be deterministic and fast.

The testing pattern follows a strict "Given-When-Then" structure:

* **Given:** An initial Model state.  
* **When:** An Event is dispatched to the update function.  
* **Then (State):** Assert that the Model has mutated to the expected state.  
* **Then (Effect):** Assert that the returned Command contains the specific Effect intent (e.g., "Expect an HTTP GET to /api/login").

This approach eliminates the need for network mocks or UI automation during the logic verification phase. If the Core outputs the correct intent data, the test passes. We rely on the Shell implementation (tested separately) to interpret that data correctly.3

## **3\. Shell Implementation: The Humble View**

The Shells in a Crux application are referred to as "humble" because they contain minimal logic. Their primary responsibility is to act as a runtime environment for the Core, translating user interactions into Events and rendering the View Model provided by the Core.2

### **3.1 Swift Shell (iOS) Implementation**

The integration of the Rust Core into an iOS application relies on UniFFI to generate Swift bindings. The standard pattern involves creating an ObservableObject that wraps the Rust Core and bridges the gap between Rust's memory model and Swift's reference counting.

#### **3.1.1 The Core Wrapper**

We create a class, typically named Core or Model, that holds the pointer to the Rust object. This class is responsible for serialization (using Bincode) and dispatching events.

Swift

import Foundation  
import SharedTypes // Generated by UniFFI

@MainActor  
class Core: ObservableObject {  
    @Published var viewModel: ViewModel  
    private let core: SharedTypes.Core // The Rust Core instance

    init() {  
        self.core \= SharedTypes.Core()  
        // Initial view state deserialization  
        self.viewModel \= try\!.bincodeDeserialize(input: \[UInt8\](core.view()))  
    }

    func update(\_ event: Event) {  
        // Serialize event and pass to Rust  
        let eventData \= try\! event.bincodeSerialize()  
        let effectsData \= core.processEvent(eventData)  
          
        // Deserialize requests (effects) from Rust  
        let requests: \= try\!.bincodeDeserialize(input: effectsData)  
          
        for request in requests {  
            processEffect(request)  
        }  
    }

    func processEffect(\_ request: Request) {  
        switch request.effect {  
        case.render:  
            // Update the local ViewModel state from the Core  
            self.viewModel \= try\!.bincodeDeserialize(input: \[UInt8\](core.view()))  
        case.http(let httpRequest):  
            // Execute HTTP request using URLSession and resolve back to Core  
            performHttp(request.id, httpRequest)  
        //... handle other effects  
        }  
    }  
}

14

#### **3.1.2 View Update Pattern**

SwiftUI views bind directly to the @Published view model. User actions trigger core.update(.someEvent). This pattern ensures the View remains purely declarative; it never calculates state, only displays it.

### **3.2 Kotlin Shell (Android) Implementation**

The Android Shell utilizes Java Native Access (JNA) to communicate with the shared Rust library compiled as a .so file. The architectural integration aligns with Android's recommended patterns, specifically using ViewModel and Coroutines.

#### **3.2.1 The Core Wrapper**

The Kotlin wrapper extends the Android ViewModel to ensure the Rust Core survives configuration changes (like screen rotation). It uses StateFlow to expose the View Model to Jetpack Compose.

Kotlin

class CoreViewModel : ViewModel() {  
    private val core \= com.example.shared.Core() // Rust Core instance  
    private val \_view \= MutableStateFlow(initialView())  
    val view: StateFlow\<ViewModel\> \= \_view.asStateFlow()

    fun update(event: Event) {  
        viewModelScope.launch {  
            val effects \= core.processEvent(event.bincodeSerialize())  
            val requests \= Requests.bincodeDeserialize(effects)  
              
            for (request in requests) {  
                processEffect(request)  
            }  
        }  
    }

    private suspend fun processEffect(request: Request) {  
        when (val effect \= request.effect) {  
            is Effect.Render \-\> {  
                \_view.value \= ViewModel.bincodeDeserialize(core.view())  
            }  
            is Effect.Http \-\> {  
                val response \= httpClient.execute(effect.value)  
                // Resolve the request back to the core  
                val newEffects \= core.handleResponse(  
                    request.id,   
                    HttpResult.Ok(response).bincodeSerialize()  
                )  
                // Recursively process new effects triggered by the response  
                processEffects(newEffects)  
            }  
        }  
    }  
}

13

#### **3.2.2 View Update Pattern**

Jetpack Compose observes the StateFlow as a state object. All UI interactions are delegated to the update function of the ViewModel.

### **3.3 Serialization and FFI Overhead**

Crux relies heavily on serialization (typically Bincode) to pass data across the FFI boundary. While this introduces a serialization/deserialization overhead compared to direct memory access, it guarantees type safety and memory isolation. The crux\_core::typegen functionality automatically generates the Swift and Kotlin data classes that correspond to the Rust structs. This ensures that any change in the Rust Model or Event schema results in a compile-time error in the Shell, preventing synchronization bugs between the layers.2

## **4\. Advanced Patterns: Orchestrating Complexity**

Migrating "Opta" implies handling scenarios significantly more complex than simple counters. This requires leveraging advanced Crux patterns such as capability composition, the async runtime, and error boundary management.

### **4.1 Nested Capabilities and Composition**

In large applications, maintaining a flat list of capabilities becomes unmanageable. Crux supports the composition of capabilities, allowing developers to build higher-level abstractions. For instance, an Auth capability might internally utilize both Http (for network calls) and KeyValue (for token storage).

To achieve this, the Capability trait supports event mapping. If a sub-component or nested capability emits an internal event, the parent App must map this to a top-level Event to route the response correctly.

Rust

\#\[derive(Effect)\]  
pub struct Capabilities {  
    pub http: Http\<Event\>,  
    pub render: Render\<Event\>,  
    \#\[effect(skip)\] // Composition capability  
    pub compose: Compose\<Event\>,  
}

This pattern allows for modular architecture where distinct business domains (Auth, Feed, Settings) can have their own isolated capability sets.10

### **4.2 Async Operations and the Capability Runtime**

The Crux async runtime is a bespoke system designed for the unique constraints of the "driven" core. Since the Core is single-threaded and lacks a persistent event loop, it cannot use standard runtimes like tokio. Instead, it uses a QueuingExecutor.8

#### **4.2.1 The Execution Cycle**

The lifecycle of an async task in Crux is distinct:

1. **Spawn:** The Core spawns a task (e.g., a sequence of API calls).  
2. **Suspend:** The task executes until it encounters an async capability call (e.g., http.get().await). The runtime generates a Request for the Shell and returns Pending, effectively freezing the task.  
3. **Resolve:** When the Shell returns the response via handle\_response, the runtime utilizes a Waker to identify and wake the specific suspended task.  
4. **Resume:** The executor re-polls the task, allowing the .await to complete and the logic to proceed.

This mechanism allows developers to write sequential, imperative-looking async code in Rust that is executed cooperatively over multiple round-trips with the Shell:

Rust

async fn login\_flow(caps: \&Capabilities) {  
    let token \= caps.http.post("/login").await?;  
    caps.kv.write("token", token).await?;  
    caps.render.render();  
}

.8

### **4.3 Error Handling Across Boundaries**

In a cross-platform context, error handling must be explicit and data-driven. Rust's Result\<T, E\> is serialized into corresponding generic types in Swift and Kotlin.

* **Core-side:** Explicit error enums (e.g., NetworkError, ValidationError) should be defined and must derive Serialize and Deserialize.  
* **Shell-side:** The generated types in the Shell will encompass cases for Ok and Err. The Shell acts as the presentation layer for these errors, determining whether to show a user-facing toast, a modal alert, or to log the error silently. The Core decides the *message* content, but the Shell decides the *mechanism* of display.

## **5\. Migration Strategy: Porting Opta**

Migrating a live application like Opta requires a risk-managed approach. A "Vertical Slice" adoption strategy is recommended over a horizontal layer-based rewrite.

### **5.1 Porting Strategy: Vertical Slices**

The most effective method involves picking a distinct, self-contained feature of Opta (e.g., "User Profile" or "Settings") and migrating it fully to Crux.

1. **Define the Slice:** Identify the Model (state) and Events (actions) required for this specific feature.  
2. **Rust Core Implementation:** Implement the App trait for this slice in the shared library.  
3. **Shell Integration:** Replace the existing view controller or activity in the host app with a new implementation backed by the Crux Core.  
4. **Interop:** If the new Core requires state from the legacy app (e.g., a global authentication token), pass this data as an initialization argument or via a synchronization Event.2

### **5.2 Mapping React Concepts to Crux**

The conceptual mapping between React and Crux aids in the translation of logic:

| React Concept | Crux Equivalent | Key Difference |
| :---- | :---- | :---- |
| useState / Redux Store | Model struct | Crux Model is monolithic per App/Slice and strictly typed. |
| useEffect (Data Fetching) | update → Command | React triggers effects on render; Crux triggers on Events. Intent is explicit. |
| React Components (JSX) | Native Views | Logic is stripped from the view. The View is strictly a projection. |
| Redux Reducers | update function | Conceptually identical. Crux adds side-effect management directly in the return type. |
| Thunks / Sagas | Capabilities / Async Rust | Managed side effects versus middleware execution. |

### **5.3 Incremental Adoption Roadmap**

Phase 1: Proof of Concept (Weeks 1-2)  
Establish the Rust workspace with crux\_core and configure uniffi for type generation. Implement a simple "Hello World" or "Counter" feature styled to match Opta. The goal is to verify the build pipeline and assess FFI overhead.  
Phase 2: The "Auth" Core (Weeks 3-5)  
Migrate Authentication logic. This is high-risk, logic-heavy, but UI-light, making it an ideal candidate for Rust. Implement Http and KeyValue capabilities for secure token management.  
Phase 3: The "Feed" Core (Weeks 6-10)  
Migrate the main content feed. Utilize the Compose capability to handle complex data fetching scenarios, such as parallel requests. Implement rigorous unit tests for pagination logic.  
Phase 4: Full Migration (Weeks 11+)  
Port remaining views and retire the legacy React state management. The ultimate goal is 100% of business logic residing in Rust.

## **6\. Detailed Working Example**

The following example demonstrates a non-trivial "Login" feature, showcasing async effects, error handling, and view modeling.

### **6.1 Rust Core (shared/src/app.rs)**

Rust

use crux\_core::{App, Command, macros::Effect};  
use crux\_http::Http;  
use serde::{Deserialize, Serialize};

\#  
pub struct LoginModel {  
    username: String,  
    status: LoginStatus,  
    auth\_token: Option\<String\>,  
}

\#  
pub enum LoginStatus {  
    \#\[default\]  
    Idle,  
    Loading,  
    Success,  
    Error(String),  
}

\#  
pub enum Event {  
    TypeUsername(String),  
    ClickLogin,  
    // Internal event for HTTP response  
    LoginResult(crux\_http::Result\<crux\_http::Response\<AuthResponse\>\>),  
}

\#  
struct AuthResponse {  
    token: String,  
}

\#\[derive(Effect)\]  
pub struct Capabilities {  
    pub http: Http\<Event\>,  
    pub render: crux\_core::render::Render\<Event\>,  
}

\#  
pub struct LoginApp;

impl App for LoginApp {  
    type Event \= Event;  
    type Model \= LoginModel;  
    type ViewModel \= ViewModel;  
    type Capabilities \= Capabilities;  
    type Effect \= Effect; // Generated by macro

    fn update(&self, event: Event, model: &mut LoginModel, caps: \&Capabilities) \-\> Command\<Effect, Event\> {  
        match event {  
            Event::TypeUsername(name) \=\> {  
                model.username \= name;  
                caps.render.render() // Request UI update  
            }  
            Event::ClickLogin \=\> {  
                model.status \= LoginStatus::Loading;  
                caps.render.render();  
                  
                // Intent: Make HTTP request  
                caps.http  
                   .post("https://api.opta.com/login")  
                   .body\_json(\&model.username)  
                   .expect\_json()   
                   .send(Event::LoginResult) // Map response to Event  
            }  
            Event::LoginResult(Ok(response)) \=\> {  
                let auth \= response.body().unwrap();  
                model.auth\_token \= Some(auth.token.clone());  
                model.status \= LoginStatus::Success;  
                caps.render.render()  
            }  
            Event::LoginResult(Err(e)) \=\> {  
                model.status \= LoginStatus::Error(format\!("Network error: {:?}", e));  
                caps.render.render()  
            }  
        }  
    }

    fn view(&self, model: \&LoginModel) \-\> ViewModel {  
        ViewModel {  
            username: model.username.clone(),  
            is\_loading: model.status \== LoginStatus::Loading,  
            error\_message: match \&model.status {  
                LoginStatus::Error(msg) \=\> Some(msg.clone()),  
                \_ \=\> None,  
            },  
        }  
    }  
}

\#  
pub struct ViewModel {  
    pub username: String,  
    pub is\_loading: bool,  
    pub error\_message: Option\<String\>,  
}

### **6.2 Swift View (iOS/LoginView.swift)**

Swift

struct LoginView: View {  
    @ObservedObject var core: Core // Wrapper described in 3.1.1

    var body: some View {  
        VStack {  
            TextField("Username", text: Binding(  
                get: { core.viewModel.username },  
                set: { core.update(.typeUsername($0)) }  
            ))  
           .disabled(core.viewModel.isLoading)

            if let error \= core.viewModel.errorMessage {  
                Text(error).foregroundColor(.red)  
            }

            if core.viewModel.isLoading {  
                ProgressView()  
            } else {  
                Button("Login") {  
                    core.update(.clickLogin)  
                }  
            }  
        }  
    }  
}

### **6.3 Kotlin View (Android/LoginScreen.kt)**

Kotlin

@Composable  
fun LoginScreen(viewModel: CoreViewModel) {  
    val state by viewModel.view.collectAsState()

    Column {  
        TextField(  
            value \= state.username,  
            onValueChange \= { viewModel.update(Event.TypeUsername(it)) },  
            enabled \=\!state.isLoading  
        )

        state.errorMessage?.let { msg \-\>  
            Text(text \= msg, color \= Color.Red)  
        }

        if (state.isLoading) {  
            CircularProgressIndicator()  
        } else {  
            Button(onClick \= { viewModel.update(Event.ClickLogin) }) {  
                Text("Login")  
            }  
        }  
    }  
}

## **7\. Implications and Strategic Value**

The migration of Opta to the Crux framework offers a high-value strategic advantage. By centralizing business logic in a singular, testable Core, the organization reduces the cognitive load on platform-specific teams and ensures behavioral consistency across devices. While the initial cost of establishing the FFI boundary and adopting the event-sourcing mindset is non-trivial, the long-term reduction in regression bugs and the decoupling of logic from UI frameworks provides a stable foundation for future scalability. The architecture enforces a level of discipline that eliminates entire classes of UI logic errors, ensuring Opta's core business rules are consistent, verified, and preserved regardless of the visual shell that presents them.

#### **Works cited**

1. crux\_core \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/crux\_core/latest/crux\_core/](https://docs.rs/crux_core/latest/crux_core/)  
2. redbadger/crux: Cross-platform app development in Rust \- GitHub, accessed January 20, 2026, [https://github.com/redbadger/crux](https://github.com/redbadger/crux)  
3. Elm Architecture \- Crux: Cross-platform app development in Rust \- GitHub Pages, accessed January 20, 2026, [https://redbadger.github.io/crux/guide/elm\_architecture.html](https://redbadger.github.io/crux/guide/elm_architecture.html)  
4. Motivation \- Crux: Cross-platform app development in Rust, accessed January 20, 2026, [https://redbadger.github.io/crux/motivation.html](https://redbadger.github.io/crux/motivation.html)  
5. Introducing CRUX \- All Articles | Our Thinking | Red Badger Insights, accessed January 20, 2026, [https://content.red-badger.com/resources/introducing-crux](https://content.red-badger.com/resources/introducing-crux)  
6. App in crux\_core \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/crux\_core/latest/crux\_core/trait.App.html](https://docs.rs/crux_core/latest/crux_core/trait.App.html)  
7. crux/examples/counter/shared/src/app.rs at master · redbadger/crux \- GitHub, accessed January 20, 2026, [https://github.com/redbadger/crux/blob/master/examples/counter/shared/src/app.rs](https://github.com/redbadger/crux/blob/master/examples/counter/shared/src/app.rs)  
8. Capability runtime and Effects \- Crux: Cross-platform app ..., accessed January 20, 2026, [https://redbadger.github.io/crux/internals/runtime.html](https://redbadger.github.io/crux/internals/runtime.html)  
9. crux/crux\_core/src/capabilities/render.rs at master \- GitHub, accessed January 20, 2026, [https://github.com/redbadger/crux/blob/master/crux\_core/src/capabilities/render.rs](https://github.com/redbadger/crux/blob/master/crux_core/src/capabilities/render.rs)  
10. Capabilities \- Crux: Cross-platform app development in Rust \- GitHub Pages, accessed January 20, 2026, [https://redbadger.github.io/crux/guide/capabilities.html](https://redbadger.github.io/crux/guide/capabilities.html)  
11. crux/crux\_http/README.md at master · redbadger/crux \- GitHub, accessed January 20, 2026, [https://github.com/redbadger/crux/blob/master/crux\_http/README.md](https://github.com/redbadger/crux/blob/master/crux_http/README.md)  
12. crux/crux\_kv/README.md at master · redbadger/crux \- GitHub, accessed January 20, 2026, [https://github.com/redbadger/crux/blob/master/crux\_kv/README.md](https://github.com/redbadger/crux/blob/master/crux_kv/README.md)  
13. Interface between core and shell \- Crux: Cross-platform app development in Rust, accessed January 20, 2026, [https://redbadger.github.io/crux/guide/message\_interface.html](https://redbadger.github.io/crux/guide/message_interface.html)  
14. Swift and SwiftUI (manual) \- Crux: Cross-platform app development in Rust \- GitHub Pages, accessed January 20, 2026, [https://redbadger.github.io/crux/getting\_started/iOS/manual.html](https://redbadger.github.io/crux/getting_started/iOS/manual.html)  
15. Swift and SwiftUI (XcodeGen) \- Crux: Cross-platform app development in Rust, accessed January 20, 2026, [https://redbadger.github.io/crux/getting\_started/iOS/with\_xcodegen.html](https://redbadger.github.io/crux/getting_started/iOS/with_xcodegen.html)  
16. Kotlin and Jetpack Compose \- Crux: Cross-platform app development in Rust, accessed January 20, 2026, [https://redbadger.github.io/crux/getting\_started/Android/android.html](https://redbadger.github.io/crux/getting_started/Android/android.html)  
17. Shared core and types \- Crux: Cross-platform app development in Rust \- GitHub Pages, accessed January 20, 2026, [https://redbadger.github.io/crux/getting\_started/core.html](https://redbadger.github.io/crux/getting_started/core.html)