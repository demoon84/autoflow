@{
  DebounceMs = 1500
  StableWriteDelayMs = 750

  Routes = @{
    plan = @{
      Enabled = $true
      Dispatch = 'codex'
      WorkerId = 'plan-hook'
      DryRun = $false
      Model = ''
      Command = ''
    }

    todo = @{
      Enabled = $true
      Dispatch = 'codex'
      WorkerId = 'todo-hook'
      ExecutionPool = 'todo-hook'
      VerifierPool = 'verify-hook'
      MaxExecutionLoadPerWorker = 1
      DryRun = $false
      Model = ''
      Command = ''
    }

    verifier = @{
      Enabled = $true
      Dispatch = 'codex'
      WorkerId = 'verify-hook'
      DryRun = $false
      Model = ''
      Command = ''
    }
  }
}
