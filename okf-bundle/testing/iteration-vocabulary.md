# Iteration vocabulary

- **Change**: one coherent code, configuration, test, or documentation update.
- **Frozen tree**: the reviewed file set and diff remain unchanged while final
  validation evidence is collected.
- **Gate**: an explicit condition that must pass before the change advances.
- **Evidence**: a command, exit code, and relevant artifact proving a gate.
- **Cell**: one dedicated Appium harness/platform combination.
- **Authoring pass**: scripts and configuration are inspected or tested without
  starting a simulator, emulator, or Appium session.
- **Live e2e pass**: an operator-gated run of a complete Appium cell.
- **Strict empty**: expected coverage data is missing or has no matching hits;
  the CLI reports exit code 2 in strict mode.
