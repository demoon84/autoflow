# DEPRECATED: legacy file-watch route configuration.
#
# This config is read only by `watch-board.sh` / `watch-board.ps1` and
# `run-hook.sh` / `run-hook.ps1`, which form the legacy script-driven
# trigger path. The supported execution model is the heartbeat-driven
# 3-runner topology (planner-1 + owner-1 + wiki-1) where AI runners
# read the board on every minute tick and call scripts as tools.
#
# This file ships only because `autoflow watch-bg` still works for
# backwards compatibility. Users on the 3-runner topology should not
# rely on it.

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
