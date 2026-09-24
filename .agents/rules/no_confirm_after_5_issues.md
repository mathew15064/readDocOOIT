# Rule: No Confirmation After Five Consecutive Issues

**Purpose**: Prevent the agent from pausing for user confirmation when it encounters a series of issues (e.g., failed edits, missing files, test failures) that exceed five consecutive occurrences.

**Behavior**:
- The agent tracks the number of consecutive issues it encounters during a workflow.
- When the count reaches **5**, the agent will automatically continue the next step without prompting the user for confirmation.
- The counter resets to **0** after a successful operation (i.e., an edit or command that succeeds without error).
- This rule applies globally across all phases of the project unless overridden by a more specific rule.

**Scope**:
- Automated edits, test runs, migrations, and any background tasks.
- Does not suppress critical error reporting; errors will still be logged and visible in the system logs.

**Implementation Note**:
- The rule is expressed in plain markdown for the Antigravity customization system to ingest.
- Place the file under the workspace’s `.agents/rules` directory so it is automatically discovered.
