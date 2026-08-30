package com.coverage

import com.facebook.react.bridge.ReactApplicationContext

class CoverageModule(
  reactContext: ReactApplicationContext,
) : NativeCoverageSpec(reactContext) {
  /**
   * Flush in-process coverage to disk.
   * TODO: port Emma RT dump (coverage.ec) — native flusher queue item.
   */
  override fun flush() {
    // no-op stub
  }

  companion object {
    const val NAME = NativeCoverageSpec.NAME
  }
}
