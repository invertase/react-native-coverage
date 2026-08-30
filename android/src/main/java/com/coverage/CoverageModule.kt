package com.coverage

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import java.io.File

class CoverageModule(
  reactContext: ReactApplicationContext,
) : NativeCoverageSpec(reactContext) {
  /**
   * Flush in-process Jacoco/Emma coverage to `filesDir/coverage.ec`.
   * No-op (logged) when the Emma RT class is absent (coverage not enabled).
   */
  override fun flush() {
    try {
      val coverageFile = File(reactApplicationContext.filesDir, COVERAGE_FILE_NAME)
      val emmaRT = Class.forName("com.vladium.emma.rt.RT")
      val dump =
        emmaRT.getMethod(
          "dumpCoverageData",
          File::class.java,
          Boolean::class.javaPrimitiveType,
          Boolean::class.javaPrimitiveType,
        )
      dump.invoke(null, coverageFile, false, false)
      Log.i(TAG, "[native-coverage] flushed Jacoco coverage to ${coverageFile.absolutePath}")
    } catch (e: ClassNotFoundException) {
      Log.w(
        TAG,
        "[native-coverage] Jacoco/Emma RT class not found; coverage is likely not enabled in this build",
      )
    } catch (e: Exception) {
      Log.e(TAG, "[native-coverage] flush failed", e)
    }
  }

  companion object {
    const val NAME = NativeCoverageSpec.NAME
    private const val TAG = "Coverage"
    private const val COVERAGE_FILE_NAME = "coverage.ec"
  }
}
