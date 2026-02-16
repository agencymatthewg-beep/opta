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
      console.error(chalk.red('✗') + ` Unsupported shell: ${shell}\n`);
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
  commands="chat do status models config sessions mcp completions"

  case "\${prev}" in
    opta)
      COMPREPLY=( $(compgen -W "\${commands} --verbose --debug --version --help" -- "\${cur}") )
      return 0
      ;;
    chat)
      COMPREPLY=( $(compgen -W "--resume --plan --model --help" -- "\${cur}") )
      return 0
      ;;
    do)
      COMPREPLY=( $(compgen -W "--model --help" -- "\${cur}") )
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
      COMPREPLY=( $(compgen -W "list get set reset --help" -- "\${cur}") )
      return 0
      ;;
    sessions)
      COMPREPLY=( $(compgen -W "list resume delete export --json --help" -- "\${cur}") )
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
    'status:Check Opta LMX server health and loaded models'
    'models:List and manage loaded models'
    'config:Manage configuration'
    'sessions:Manage chat sessions'
    'mcp:Model Context Protocol tools'
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
            '--model[override default model]:model name:'
          ;;
        do)
          _arguments \\
            '--model[use specific model]:model name:'
          ;;
        status)
          _arguments \\
            '--json[machine-readable output]'
          ;;
        models)
          _arguments '1:action:(use info load unload)'
          ;;
        config)
          _arguments '1:action:(list get set reset)'
          ;;
        sessions)
          _arguments '1:action:(list resume delete export)' '--json[machine-readable output]'
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
complete -c opta -n '__fish_use_subcommand' -a status -d 'Check Opta LMX server health'
complete -c opta -n '__fish_use_subcommand' -a models -d 'List and manage loaded models'
complete -c opta -n '__fish_use_subcommand' -a config -d 'Manage configuration'
complete -c opta -n '__fish_use_subcommand' -a sessions -d 'Manage chat sessions'
complete -c opta -n '__fish_use_subcommand' -a mcp -d 'Model Context Protocol tools'
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

# do flags
complete -c opta -n '__fish_seen_subcommand_from do' -l model -s m -d 'Use specific model' -x

# status flags
complete -c opta -n '__fish_seen_subcommand_from status' -l json -d 'Machine-readable output'

# models subcommands
complete -c opta -n '__fish_seen_subcommand_from models' -a 'use info load unload' -d 'Action'

# config subcommands
complete -c opta -n '__fish_seen_subcommand_from config' -a 'list get set reset' -d 'Action'

# sessions subcommands
complete -c opta -n '__fish_seen_subcommand_from sessions' -a 'list resume delete export' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from sessions' -l json -d 'Machine-readable output'

# completions subcommands
complete -c opta -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish' -d 'Shell'`;
}
