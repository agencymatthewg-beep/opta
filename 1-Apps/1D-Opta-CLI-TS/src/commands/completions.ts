import chalk from 'chalk';
import { EXIT } from '../core/errors.js';

export async function completions(shell: string): Promise<void> {
  switch (shell.toLowerCase()) {
    case 'bash':
      console.log(bashCompletions());
      break;
    case 'zsh':
      console.log(zshCompletions());
      break;
    case 'fish':
      console.log(fishCompletions());
      break;
    default:
      console.error(chalk.red('\u2717') + ` Unsupported shell: ${shell}\n`);
      console.log(chalk.dim('Supported: bash, zsh, fish'));
      process.exit(EXIT.MISUSE);
  }
}

function bashCompletions(): string {
  return `# opta bash completions
# Add to ~/.bashrc: eval "$(opta completions bash)"

_opta_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="chat do init doctor status models config sessions mcp diff server serve completions"

  case "\${prev}" in
    opta)
      COMPREPLY=( $(compgen -W "\${commands} --verbose --debug --version --help" -- "\${cur}") )
      return 0
      ;;
    chat)
      COMPREPLY=( $(compgen -W "--resume --plan --model --format --no-commit --no-checkpoints --auto --dangerous --yolo --tui --help" -- "\${cur}") )
      return 0
      ;;
    do)
      COMPREPLY=( $(compgen -W "--model --format --quiet --output --no-commit --no-checkpoints --auto --dangerous --yolo --help" -- "\${cur}") )
      return 0
      ;;
    status)
      COMPREPLY=( $(compgen -W "--json --help" -- "\${cur}") )
      return 0
      ;;
    models)
      COMPREPLY=( $(compgen -W "use info load unload --json --help" -- "\${cur}") )
      return 0
      ;;
    config)
      COMPREPLY=( $(compgen -W "list get set reset --json --help" -- "\${cur}") )
      return 0
      ;;
    sessions)
      COMPREPLY=( $(compgen -W "list resume delete export --json --help" -- "\${cur}") )
      return 0
      ;;
    mcp)
      COMPREPLY=( $(compgen -W "add remove test list --help" -- "\${cur}") )
      return 0
      ;;
    init)
      COMPREPLY=( $(compgen -W "--yes --force --help" -- "\${cur}") )
      return 0
      ;;
    doctor)
      COMPREPLY=( $(compgen -W "--json --help" -- "\${cur}") )
      return 0
      ;;
    diff)
      COMPREPLY=( $(compgen -W "--session --help" -- "\${cur}") )
      return 0
      ;;
    server)
      COMPREPLY=( $(compgen -W "--port --host --model --help" -- "\${cur}") )
      return 0
      ;;
    serve)
      COMPREPLY=( $(compgen -W "start stop restart logs --json --help" -- "\${cur}") )
      return 0
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      return 0
      ;;
  esac

  return 0
}
complete -F _opta_completions opta`;
}

function zshCompletions(): string {
  return `#compdef opta
# opta zsh completions
# Add to ~/.zshrc: eval "$(opta completions zsh)"

_opta() {
  local -a commands
  commands=(
    'chat:Start an interactive AI chat session'
    'do:Execute a coding task using the agent loop'
    'init:Initialize OPIS project intelligence docs'
    'doctor:Check environment health and diagnose issues'
    'status:Check Opta LMX server health and loaded models'
    'models:List and manage loaded models'
    'config:Manage configuration'
    'sessions:Manage chat sessions'
    'mcp:Model Context Protocol tools'
    'diff:Show changes made in a session'
    'server:Start an HTTP API server for non-interactive use'
    'serve:Manage the remote Opta LMX inference server'
    'completions:Generate shell completions'
  )

  _arguments -C \\
    '--verbose[detailed output]' \\
    '--debug[debug info including API calls]' \\
    '--version[show version]' \\
    '--help[show help]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case "\$state" in
    command)
      _describe 'command' commands
      ;;
    args)
      case "\${words[1]}" in
        chat)
          _arguments \\
            '--resume[resume a previous session]:session id:' \\
            '--plan[plan mode]' \\
            '--model[override default model]:model name:' \\
            '--format[output format]:format:(text json)' \\
            '--no-commit[disable auto-commit]' \\
            '--no-checkpoints[disable checkpoint creation]' \\
            '--auto[auto-accept file edits]' \\
            '--dangerous[bypass all permission prompts]' \\
            '--yolo[alias for --dangerous]' \\
            '--tui[use full-screen terminal UI]'
          ;;
        do)
          _arguments \\
            '--model[use specific model]:model name:' \\
            '--format[output format]:format:(text json)' \\
            '--quiet[suppress output]' \\
            '--output[write result to file]:file path:_files' \\
            '--no-commit[disable auto-commit]' \\
            '--no-checkpoints[disable checkpoint creation]' \\
            '--auto[auto-accept file edits]' \\
            '--dangerous[bypass all permission prompts]' \\
            '--yolo[alias for --dangerous]'
          ;;
        status)
          _arguments \\
            '--json[machine-readable output]'
          ;;
        models)
          _arguments '1:action:(use info load unload)' '--json[machine-readable output]'
          ;;
        config)
          _arguments '1:action:(list get set reset)' '--json[machine-readable output]'
          ;;
        sessions)
          _arguments '1:action:(list resume delete export)' '--json[machine-readable output]'
          ;;
        mcp)
          _arguments '1:action:(add remove test list)' '--json[machine-readable output]'
          ;;
        init)
          _arguments \\
            '--yes[skip prompts, use defaults]' \\
            '--force[overwrite existing APP.md]'
          ;;
        doctor)
          _arguments \\
            '--json[machine-readable output]'
          ;;
        diff)
          _arguments \\
            '--session[session to diff]:session id:'
          ;;
        server)
          _arguments \\
            '--port[server port]:port:' \\
            '--host[server bind address]:host:' \\
            '--model[override default model]:model name:'
          ;;
        serve)
          _arguments '1:action:(start stop restart logs)' '--json[machine-readable output]'
          ;;
        completions)
          _arguments '1:shell:(bash zsh fish)'
          ;;
      esac
      ;;
  esac
}

_opta "\$@"`;
}

function fishCompletions(): string {
  return `# opta fish completions
# Save to ~/.config/fish/completions/opta.fish

# Disable file completions
complete -c opta -f

# Commands
complete -c opta -n '__fish_use_subcommand' -a chat -d 'Start an interactive AI chat session'
complete -c opta -n '__fish_use_subcommand' -a do -d 'Execute a coding task'
complete -c opta -n '__fish_use_subcommand' -a init -d 'Initialize OPIS project intelligence docs'
complete -c opta -n '__fish_use_subcommand' -a doctor -d 'Check environment health and diagnose issues'
complete -c opta -n '__fish_use_subcommand' -a status -d 'Check Opta LMX server health'
complete -c opta -n '__fish_use_subcommand' -a models -d 'List and manage loaded models'
complete -c opta -n '__fish_use_subcommand' -a config -d 'Manage configuration'
complete -c opta -n '__fish_use_subcommand' -a sessions -d 'Manage chat sessions'
complete -c opta -n '__fish_use_subcommand' -a mcp -d 'Model Context Protocol tools'
complete -c opta -n '__fish_use_subcommand' -a diff -d 'Show changes made in a session'
complete -c opta -n '__fish_use_subcommand' -a server -d 'Start HTTP API server'
complete -c opta -n '__fish_use_subcommand' -a serve -d 'Manage remote Opta LMX server'
complete -c opta -n '__fish_use_subcommand' -a completions -d 'Generate shell completions'

# Global flags
complete -c opta -l verbose -d 'Detailed output'
complete -c opta -l debug -d 'Debug info including API calls'
complete -c opta -l version -s V -d 'Show version'
complete -c opta -l help -s h -d 'Show help'

# chat flags
complete -c opta -n '__fish_seen_subcommand_from chat' -l resume -s r -d 'Resume session' -x
complete -c opta -n '__fish_seen_subcommand_from chat' -l plan -d 'Plan mode'
complete -c opta -n '__fish_seen_subcommand_from chat' -l model -s m -d 'Override model' -x
complete -c opta -n '__fish_seen_subcommand_from chat' -l format -s f -d 'Output format' -x -a 'text json'
complete -c opta -n '__fish_seen_subcommand_from chat' -l no-commit -d 'Disable auto-commit'
complete -c opta -n '__fish_seen_subcommand_from chat' -l no-checkpoints -d 'Disable checkpoints'
complete -c opta -n '__fish_seen_subcommand_from chat' -l auto -s a -d 'Auto-accept file edits'
complete -c opta -n '__fish_seen_subcommand_from chat' -l dangerous -d 'Bypass permission prompts'
complete -c opta -n '__fish_seen_subcommand_from chat' -l yolo -d 'Alias for --dangerous'
complete -c opta -n '__fish_seen_subcommand_from chat' -l tui -d 'Full-screen terminal UI'

# do flags
complete -c opta -n '__fish_seen_subcommand_from do' -l model -s m -d 'Use specific model' -x
complete -c opta -n '__fish_seen_subcommand_from do' -l format -s f -d 'Output format' -x -a 'text json'
complete -c opta -n '__fish_seen_subcommand_from do' -l quiet -s q -d 'Suppress output'
complete -c opta -n '__fish_seen_subcommand_from do' -l output -s o -d 'Write result to file' -r
complete -c opta -n '__fish_seen_subcommand_from do' -l no-commit -d 'Disable auto-commit'
complete -c opta -n '__fish_seen_subcommand_from do' -l no-checkpoints -d 'Disable checkpoints'
complete -c opta -n '__fish_seen_subcommand_from do' -l auto -s a -d 'Auto-accept file edits'
complete -c opta -n '__fish_seen_subcommand_from do' -l dangerous -d 'Bypass permission prompts'
complete -c opta -n '__fish_seen_subcommand_from do' -l yolo -d 'Alias for --dangerous'

# status flags
complete -c opta -n '__fish_seen_subcommand_from status' -l json -d 'Machine-readable output'

# models subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from models' -a 'use info load unload' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from models' -l json -d 'Machine-readable output'

# config subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from config' -a 'list get set reset' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from config' -l json -d 'Machine-readable output'

# sessions subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from sessions' -a 'list resume delete export' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from sessions' -l json -d 'Machine-readable output'

# mcp subcommands
complete -c opta -n '__fish_seen_subcommand_from mcp' -a 'add remove test list' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from mcp' -l json -d 'Machine-readable output'

# init flags
complete -c opta -n '__fish_seen_subcommand_from init' -l yes -s y -d 'Skip prompts, use defaults'
complete -c opta -n '__fish_seen_subcommand_from init' -l force -d 'Overwrite existing APP.md'

# doctor flags
complete -c opta -n '__fish_seen_subcommand_from doctor' -l json -d 'Machine-readable output'

# diff flags
complete -c opta -n '__fish_seen_subcommand_from diff' -l session -s s -d 'Session to diff' -x

# server flags
complete -c opta -n '__fish_seen_subcommand_from server' -l port -s p -d 'Server port' -x
complete -c opta -n '__fish_seen_subcommand_from server' -l host -d 'Server bind address' -x
complete -c opta -n '__fish_seen_subcommand_from server' -l model -s m -d 'Override model' -x

# serve subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from serve' -a 'start stop restart logs' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from serve' -l json -d 'Machine-readable output'

# completions subcommands
complete -c opta -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish' -d 'Shell'`;
}
