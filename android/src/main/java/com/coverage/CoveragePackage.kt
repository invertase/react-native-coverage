package com.coverage

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.util.HashMap

class CoveragePackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == CoverageModule.NAME) {
      CoverageModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider() =
    ReactModuleInfoProvider {
      mapOf(
        CoverageModule.NAME to
          ReactModuleInfo(
            name = CoverageModule.NAME,
            className = CoverageModule.NAME,
            canOverrideExistingModule = false,
            needsEagerInit = false,
            isCxxModule = false,
            isTurboModule = true,
          ),
      )
    }
}
