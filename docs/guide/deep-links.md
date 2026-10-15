# Deep links

Routes are paths, so wherever your app receives a link (a URL handler, a notification payload), hand the path to the router:

```ts
router.push('/messages/42')
```

That's safe on a cold start: a navigation requested before the first page is up waits for it and stacks on top, so back still lands on your home page.

## Bringing the parents along

A link into a nested page can bring its parents along, so back walks up the app's hierarchy instead of jumping home:

```ts
router.push('/settings/account', { withParents: true })
// stack: / → /settings → /settings/account
```

The parents come from `children` nesting in the route table, and only those with a component become pages:

```ts
{
  path: '/settings',
  component: Settings,
  children: [{ path: 'account', name: 'account', component: Account }],
}
```

Parents already on top are skipped, only the last page animates, and guards run for every page. With `clearHistory`, the parents and the page become the whole stack. `<RouterLink>` takes `withParents` too.

## Receiving operating-system URLs

The router accepts app locations; it does not register URL schemes, Android App Links or iOS Universal Links. Configure that integration in your app and map incoming URLs to known paths before calling `push`. Validate the scheme/host and apply authentication guards to external links too.

The `frame` option targets a stack but does not select its `TabView` tab. Select an unloaded tab before awaiting navigation into it. See [tabs](./tabs).
