# example-dynamic (primary iOS cell)

Bare React Native harness with **`use_frameworks! :linkage => :dynamic`**.

Expo cannot prove distinct `Coverage*` / `CoverageFixture` dynamic framework
images: Expo force-statics React-Core, and CocoaPods rejects dynamic Coverage*
pods that transitively depend on static React. See `docs/integration/ios.md`.

This app is the **primary CI cell** for multi-image LINKEDIT + non-zero
fixture-lib coverage under Appium.

```sh
# from repo root
yarn
yarn prepare
cd example-dynamic
yarn pod:install
yarn ios:build
# then Appium e2e via repo scripts / CI
```
