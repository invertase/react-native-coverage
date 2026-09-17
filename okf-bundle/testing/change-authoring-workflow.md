# Change authoring workflow

1. Define the intended behavior, affected harnesses, and required coverage
   evidence.
2. Inspect the repository-specific commands and constraints in this bundle.
3. Make the smallest coherent change and add deterministic tests where the
   behavior can be exercised without a device.
4. Run the applicable validation checklist. Record commands and exit codes.
5. Freeze the tree: inspect the final diff and do not edit files during final
   validation.
6. Run final gates against that frozen tree. A failed gate reopens authoring;
   after a fix, freeze and validate again.

Required gates are build/type safety, tests relevant to the change, lint, CLI
smoke testing, and documentation consistency. Native/Appium changes also need
artifact-backed live e2e evidence, but live cells run only in CI or with
explicit operator approval.

Validation evidence should name the command, exit code, cell (when applicable),
and artifact paths. Never claim device behavior from script inspection alone.
