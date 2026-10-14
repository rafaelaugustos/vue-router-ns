---
layout: home

hero:
  text: Vue Router's API, on the native stack.
  tagline: Routes, guards, params and typed names for NativeScript-Vue 3, with a Frame's back stack as the source of truth instead of a URL.
  image:
    light: /logo.png
    dark: /logo-dark.png
    alt: vue-router-ns
  actions:
    - theme: brand
      text: Get started
      link: /guide/install
    - theme: alt
      text: What it is
      link: /guide/
    - theme: alt
      text: Differences from Vue Router
      link: /guide/vue-router

features:
  - title: A route per page
    details: Pages stay alive under each other, so useRoute() inside a page never changes while others are pushed on top.
  - title: Guards that the platform respects
    details: Leave guards run on back, on the Android back button, on the iOS back button and on a modal swiped down, and turn the iOS swipe off while they'd block it.
  - title: Modals, results and tabs
    details: Modal routes with their own stack, pushForResult() to get a value back, one stack per tab, and a tap on the active tab that goes back to its first page.
  - title: Typed routes
    details: Names and params inferred from the route table and checked across the app, with no code generation.
  - title: Deep links and whole stacks
    details: Push a page with its parents, set the stack as a list, and restore it after Android killed the app in the background.
  - title: Nothing runs between taps
    details: The router mirrors the frame after every native navigation. Swipes and pops it didn't start are picked up the same way as its own.
---
