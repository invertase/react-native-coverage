package com.coverage.fixture

import com.facebook.react.bridge.ReactApplicationContext

class CoverageFixtureModule(
  reactContext: ReactApplicationContext,
) : NativeCoverageFixtureSpec(reactContext) {
  private var hits = 0

  override fun hit(): Double {
    hits += 1
    var acc = 0
    for (i in 0 until 8) {
      acc += if (i % 2 == 0) i * 3 else -i
    }
    if (hits > 0) {
      acc += hits
    }
    return acc.toDouble()
  }

  companion object {
    const val NAME = NativeCoverageFixtureSpec.NAME
  }
}
