# A protected drop that continues after login

Copy [policy.ts](./policy.ts), [login.ts](./login.ts) and the platform bridge into
the application. The optional typed `handoff` runs after the shared policy has
validated the payload, waited for readiness and checked the receiving registration.
Omitting it retains the original `openIntent` behavior. These helpers are application
recipes; they add no router API or NativeHost requirement.

Use admission to limit which known destinations may request access. Use the login
helper's authorization callback to grant actual content access after sign-in.
Neither a custom native type, source label nor a public document id proves permission.
The receiving app owns the router, account scope, window, Frame and history policy.

```ts
const login = createDropLogin({
  owner: () => inboxRegistration,
  session: () => currentAuthenticationFlow,
  authenticated: () => account.signedIn,
  authorize: (location) => accountCanRead(location),
  async presentLogin(owner, request) {
    loginScreen.request = request
    // Reuse an existing Login Page and update its request when a newer drop arrives.
    if (!loginScreen.isVisible) {
      const failure = await owner.router.push('/login', { frame: owner.frame })
      if (failure) throw new Error('Login presentation refused')
    } else {
      selectedTab.value = 'inbox'
    }
  },
})
const policy = createDropPolicy({
  owner: () => inboxRegistration,
  authorize: (location) => mayRequestDocumentAccess(location),
  handoff: login.handoff,
})

// Native drop and ordinary button/keyboard actions use this same policy.
const result = await policy.drop(actionId, items)
if (result.status === 'settled' && result.navigation.status === 'suspended') {
  showPendingLogin(result.navigation.state)
}

// Only after the real authentication provider succeeds:
const outcome = await loginScreen.request.resume()
showNavigationOutcome(outcome)
```

`presentLogin` resolves when app-owned UI is visible. It must not wait for a user or
an external authentication provider. Native transfer acceptance has already happened;
the handoff may return a suspended request while the document remains unopened.
`settled` means that this handoff returned; inspect its `navigation.status` and the
suspension's reactive state before claiming navigation success.

The original delivery scope/id remains reserved through suspension and resumption.
Repeated drop callbacks cannot create another login. An authorized `resume()` attempt
has one shared Promise, including subsequent completion callbacks. A newer accepted
request supersedes the previous one; update the existing Login Page to the new
handle. Malformed, duplicate or pre-admission denied drops leave the existing flow
alone. One login continuation is retained per router, within the existing five-minute
maximum lifetime and intent bounds.

The session callback must return the same object throughout the intended login.
Replace it on sign-out, another account or a new authentication flow. Final permission
checks must be synchronous and pure. The helper reuses `suspendIntent` even for an
already signed-in request, so current owner/session/permission are checked through
asynchronous guards and redirects. Routes are resolved again on resume. The app's
normal guards still run and may refuse navigation. See [the existing resumption
contract](../../docs/guide/deep-links.md#resume-after-login) for admission and native
transition boundaries.

Only a continuation that presents login receives trusted `replace: true`, so the
protected destination replaces Login while preserving the receiving stack's root.
An already signed-in drop keeps its original history policy. Payloads cannot supply
replacement, account or target authority. Apps using another login/history layout
should deliberately adapt that policy and validate its native behavior.

Cancel the request when login is dismissed, including native Back, and clean up the
Login Page in the application. A page leave guard can cancel a **pending** request;
an authorized continuation is already **resuming** and must be allowed to leave
Login. The [fixture](../../demo/src/testing/droplogin-app.ts) demonstrates both a
Cancel button and actual Android system Back. Keep cancellation bound to that
Login Page's current request, especially when reusing it for a newer delivery.

```ts
// In the app-owned Login Page:
onBeforeRouteLeave(() => {
  if (loginScreen.request.state.value.status === 'pending') loginScreen.request.cancel()
})

// Registration removed, account replaced or owning window torn down:
policy.dispose()
login.dispose()
targetInteraction.dispose()
```

Cancellation blocks future admission; it does not roll back a native transition
already started. Pending UI and protected-history cleanup on sign-out remain app
responsibilities. A throwing/rejected login presentation cancels its reserved
request. An application callback or guard that never settles is not forcibly
terminated. No credentials, provider callbacks or suspension handles are serialized
or persisted through process death.

The [stage 4 native report](../../test/native-drop-login-stage4.md) covers actual
Android drags into native Login Pages, button/keyboard alternatives, native Back,
repeat/supersession, expiry, route removal, guard refusal and permission revocation
during a waiting guard. Authentication is controlled fixture state, without an
external identity provider. This recording does not establish the combined flow on
physical devices, iPad, multiple windows or a screen reader.
