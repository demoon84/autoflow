@{
  DebounceMs = 1500
  StableWriteDelayMs = 750

  Routes = @{
    ticket = @{
      Enabled = $true
      Dispatch = 'codex'
      WorkerId = 'owner-hook'
      DryRun = $false
      Model = ''
      Command = ''
    }

    plan = @{
      Enabled = $false
      Dispatch = 'codex'
      WorkerId = 'plan-hook'
      DryRun = $false
      Model = ''
      Command = ''
    }

    todo = @{
      Enabled = $false
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
      Enabled = $false
      Dispatch = 'codex'
      WorkerId = 'verify-hook'
      DryRun = $false
      Model = ''
      Command = ''
    }
  }
}
