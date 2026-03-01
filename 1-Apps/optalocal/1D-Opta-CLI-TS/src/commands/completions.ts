import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { EXIT, ExitError } from '../core/errors.js';

function detectShell(): string | null {
  const shellEnv = process.env['SHELL'] ?? '';
  if (shellEnv.endsWith('/zsh')) return 'zsh';
  if (shellEnv.endsWith('/bash')) return 'bash';
  if (shellEnv.endsWith('/fish')) return 'fish';
  return null;
}

export function completions(shell?: string, opts?: { install?: boolean }): void {
  const resolved = shell?.toLowerCase() ?? detectShell();
  if (!resolved) {
    console.error(
      chalk.red('\u2717') + ' Could not detect shell. Specify one: opta completions <bash|zsh|fish>'
    );
    throw new ExitError(EXIT.MISUSE);
  }

  let script: string;
  switch (resolved) {
    case 'bash':
      script = bashCompletions();
      break;
    case 'zsh':
      script = zshCompletions();
      break;
    case 'fish':
      script = fishCompletions();
      break;
    default:
      console.error(chalk.red('\u2717') + ` Unsupported shell: ${resolved}\n`);
      console.log(chalk.dim('Supported: bash, zsh, fish'));
      throw new ExitError(EXIT.MISUSE);
  }

  if (opts?.install) {
    installCompletions(resolved, script);
  } else {
    console.log(script);
  }
}

function installCompletions(shell: string, script: string): void {
  const home = homedir();
  let targetPath: string;
  let addToProfile: string;

  switch (shell) {
    case 'bash': {
      const dir = join(home, '.bash_completion.d');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      targetPath = join(dir, 'opta');
      addToProfile = `Add to ~/.bashrc:  source ~/.bash_completion.d/opta`;
      break;
    }
    case 'zsh': {
      const dir = join(home, '.zsh/completions');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      targetPath = join(dir, '_opta');
      addToProfile = `Add to ~/.zshrc (before compinit):  fpath=(~/.zsh/completions $fpath)`;
      break;
    }
    case 'fish': {
      const dir = join(home, '.config/fish/completions');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      targetPath = join(dir, 'opta.fish');
      addToProfile = 'Fish completions are auto-loaded from this path.';
      break;
    }
    default:
      return;
  }

  writeFileSync(targetPath, script + '\n', 'utf-8');
  console.log(chalk.green('\u2713') + ` Completions written to ${targetPath}`);
  console.log(chalk.dim(addToProfile));
}

function bashCompletions(): string {
  return `# opta bash completions
# Add to ~/.bashrc: eval "$(opta completions bash)"

_opta_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="chat tui do embed rerank benchmark onboard setup init doctor status models env config account key keychain sessions mcp diff server daemon serve update version completions"

  case "\${prev}" in
    opta)
      COMPREPLY=( $(compgen -W "\${commands} --resume --plan --review --research --model --provider --device --format --no-commit --no-checkpoints --auto --dangerous --yolo --verbose --debug --version --help" -- "\${cur}") )
      return 0
      ;;
    do)
      COMPREPLY=( $(compgen -W "--model --format --quiet --output --no-commit --no-checkpoints --auto --dangerous --yolo --help" -- "\${cur}") )
      return 0
      ;;
    benchmark)
      COMPREPLY=( $(compgen -W "--output --query --words --max-results --provider-order --serve --host --port --force --json --help" -- "\${cur}") )
      return 0
      ;;
    status)
      COMPREPLY=( $(compgen -W "--json --help" -- "\${cur}") )
      return 0
      ;;
    models)
      COMPREPLY=( $(compgen -W "list manage dashboard scan use info load unload swap stop alias aliases unalias download delete benchmark predictor helpers quantize agents skills rag health browse-local browse-library --json --help" -- "\${cur}") )
      return 0
      ;;
    env)
      COMPREPLY=( $(compgen -W "list show save use delete --host --port --admin-key --model --provider --mode --json --help" -- "\${cur}") )
      return 0
      ;;
    config)
      COMPREPLY=( $(compgen -W "list get set reset menu --json --help" -- "\${cur}") )
      return 0
      ;;
    sessions)
      COMPREPLY=( $(compgen -W "list resume delete export search --json --help" -- "\${cur}") )
      return 0
      ;;
    mcp)
      COMPREPLY=( $(compgen -W "add add-playwright remove test list --help" -- "\${cur}") )
      return 0
      ;;
    init)
      COMPREPLY=( $(compgen -W "--yes --force --help" -- "\${cur}") )
      return 0
      ;;
    doctor)
      COMPREPLY=( $(compgen -W "--json --format --help" -- "\${cur}") )
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
    daemon)
      COMPREPLY=( $(compgen -W "start run stop status logs --host --port --token --model --json --help" -- "\${cur}") )
      return 0
      ;;
    serve)
      COMPREPLY=( $(compgen -W "start stop restart logs --json --help" -- "\${cur}") )
      return 0
      ;;
    update)
      COMPREPLY=( $(compgen -W "--components --target --remote-host --remote-user --identity-file --local-root --remote-root --dry-run --no-build --no-pull --json --help" -- "\${cur}") )
      return 0
      ;;
    chat)
      COMPREPLY=( $(compgen -W "--tui --plan --review --research --resume --model --provider --device --format --no-commit --no-checkpoints --auto --dangerous --yolo --help" -- "\${cur}") )
      return 0
      ;;
    embed)
      COMPREPLY=( $(compgen -W "--model --device --remote --json --help" -- "\${cur}") )
      return 0
      ;;
    rerank)
      COMPREPLY=( $(compgen -W "--documents --model --device --top-k --json --help" -- "\${cur}") )
      return 0
      ;;
    account)
      COMPREPLY=( $(compgen -W "signup login status keys logout --help" -- "\${cur}") )
      return 0
      ;;
    key)
      COMPREPLY=( $(compgen -W "create show copy --help" -- "\${cur}") )
      return 0
      ;;
    keychain)
      COMPREPLY=( $(compgen -W "status set-anthropic set-lmx delete-anthropic delete-lmx --help" -- "\${cur}") )
      return 0
      ;;
    version)
      COMPREPLY=( $(compgen -W "--check --help" -- "\${cur}") )
      return 0
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish --install" -- "\${cur}") )
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
    'tui:Launch full-screen TUI (alias for chat --tui)'
    'do:Execute a coding task using the agent loop'
    'embed:Create embeddings via Opta LMX'
    'rerank:Rerank candidate documents via Opta LMX'
    'benchmark:Generate benchmark suite apps (landing, chess, AI news)'
    'onboard:Run guided setup wizard'
    'init:Initialize OPIS project intelligence docs'
    'doctor:Check environment health and diagnose issues'
    'status:Check Opta LMX server health and loaded models'
    'models:List and manage loaded models'
    'env:Manage named environment profiles'
    'config:Manage configuration'
    'account:Manage Opta account authentication'
    'key:Manage Opta inference API keys'
    'keychain:Manage API keys in OS secure keychain'
    'sessions:Manage chat sessions'
    'mcp:Model Context Protocol tools'
    'diff:Show changes made in a session'
    'server:Start an HTTP API server for non-interactive use'
    'daemon:Manage Opta Level 3 daemon runtime'
    'serve:Manage the remote Opta LMX inference server'
    'update:Update Opta components on local/remote targets'
    'version:Show version with optional update check'
    'completions:Generate shell completions'
  )

  _arguments -C \\
    '--verbose[detailed output]' \\
    '--debug[debug info including API calls]' \\
    '--version[show version]' \\
    '--help[show help]' \\
    '--resume[resume a previous session]:session id:' \\
    '--plan[plan mode — design implementation approach]' \\
    '--review[code review mode — structured review output]' \\
    '--research[research mode — explore ideas, gather info]' \\
    '--model[override default model]:model name:' \\
    '--format[output format]:format:(text json)' \\
    '--no-commit[disable auto-commit]' \\
    '--no-checkpoints[disable checkpoint creation]' \\
    '--auto[auto-accept file edits]' \\
    '--dangerous[bypass all permission prompts]' \\
    '--yolo[alias for --dangerous]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case "\$state" in
    command)
      _describe 'command' commands
      ;;
    args)
      case "\${words[1]}" in
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
        benchmark)
          _arguments \\
            '--output[output directory]:dir:_files -/' \\
            '--query[override AI news query]:text:' \\
            '--words[minimum AI news word count]:n:' \\
            '--max-results[max research results]:n:' \\
            '--provider-order[provider order]:providers:(tavily gemini exa brave groq)' \\
            '--serve[serve generated suite over local HTTP]' \\
            '--host[host for local benchmark server]:host:' \\
            '--port[port for local benchmark server]:port:' \\
            '--force[allow existing output directory]' \\
            '--json[machine-readable output]'
          ;;
        status)
          _arguments \\
            '--json[machine-readable output]'
          ;;
        models)
          _arguments '1:action:(list manage dashboard scan use info load unload swap stop alias aliases unalias download delete benchmark predictor helpers quantize agents skills rag health browse-local browse-library)' '--json[machine-readable output]'
          ;;
        env)
          _arguments '1:action:(list show save use delete)' \\
            '--host[override host while saving]:host:' \\
            '--port[override port while saving]:port:' \\
            '--admin-key[override admin key while saving]:key:' \\
            '--model[override model while saving]:model name:' \\
            '--provider[profile provider]:provider:(lmx anthropic)' \\
            '--mode[default mode]:mode:(safe auto plan review research dangerous ci)' \\
            '--json[machine-readable output]'
          ;;
        config)
          _arguments '1:action:(list get set reset menu)' '--json[machine-readable output]'
          ;;
        sessions)
          _arguments '1:action:(list resume delete export search)' '--json[machine-readable output]'
          ;;
        mcp)
          _arguments '1:action:(add add-playwright remove test list)' '--json[machine-readable output]'
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
        daemon)
          _arguments '1:action:(start run stop status logs)' \\
            '--host[bind host]:host:' \\
            '--port[preferred port]:port:' \\
            '--token[daemon session token]:token:' \\
            '--model[override daemon model]:model name:' \\
            '--json[machine-readable output]'
          ;;
        serve)
          _arguments '1:action:(start stop restart logs)' '--json[machine-readable output]'
          ;;
        update)
          _arguments \\
            '--components[comma-separated components]:components:(cli lmx plus web)' \\
            '--target[target mode]:target:(auto local remote both)' \\
            '--remote-host[override remote host]:host:' \\
            '--remote-user[override SSH user]:user:' \\
            '--identity-file[override SSH identity file]:file:_files' \\
            '--local-root[override local apps root]:dir:_files -/' \\
            '--remote-root[override remote apps root]:dir:' \\
            '--dry-run[show planned commands without executing]' \\
            '--no-build[skip build/install/restart steps]' \\
            '--no-pull[skip git fetch/pull steps]' \\
            '--json[machine-readable output]'
          ;;
        chat)
          _arguments \\
            '--tui[full-screen TUI mode]' \\
            '--plan[plan mode]' \\
            '--review[code review mode]' \\
            '--research[research mode]' \\
            '--resume[resume session]:session id:' \\
            '--model[override model]:model name:' \\
            '--provider[override provider]:provider:(lmx anthropic)' \\
            '--device[target LLM device]:host:'
          ;;
        embed)
          _arguments \\
            '--model[embedding model id]:model:' \\
            '--device[target LLM device]:host:' \\
            '--remote[use configured remote host]' \\
            '--json[machine-readable output]'
          ;;
        rerank)
          _arguments \\
            '--documents[pipe-separated documents]:docs:' \\
            '--model[reranker model id]:model:' \\
            '--device[target LLM device]:host:' \\
            '--top-k[return top N results]:n:' \\
            '--json[machine-readable output]'
          ;;
        account)
          _arguments '1:action:(signup login status keys logout)'
          ;;
        key)
          _arguments '1:action:(create show copy)'
          ;;
        keychain)
          _arguments '1:action:(status set-anthropic set-lmx delete-anthropic delete-lmx)'
          ;;
        version)
          _arguments '--check[check for newer version on npm]'
          ;;
        completions)
          _arguments '1:shell:(bash zsh fish)' '--install[write to shell config location]'
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
complete -c opta -n '__fish_use_subcommand' -a chat -d 'Start interactive AI chat session'
complete -c opta -n '__fish_use_subcommand' -a tui -d 'Launch full-screen TUI'
complete -c opta -n '__fish_use_subcommand' -a do -d 'Execute a coding task'
complete -c opta -n '__fish_use_subcommand' -a embed -d 'Create embeddings via Opta LMX'
complete -c opta -n '__fish_use_subcommand' -a rerank -d 'Rerank documents via Opta LMX'
complete -c opta -n '__fish_use_subcommand' -a benchmark -d 'Generate benchmark suite apps'
complete -c opta -n '__fish_use_subcommand' -a onboard -d 'Run guided setup wizard'
complete -c opta -n '__fish_use_subcommand' -a init -d 'Initialize OPIS project intelligence docs'
complete -c opta -n '__fish_use_subcommand' -a doctor -d 'Check environment health and diagnose issues'
complete -c opta -n '__fish_use_subcommand' -a status -d 'Check Opta LMX server health'
complete -c opta -n '__fish_use_subcommand' -a models -d 'List and manage loaded models'
complete -c opta -n '__fish_use_subcommand' -a env -d 'Manage named environment profiles'
complete -c opta -n '__fish_use_subcommand' -a config -d 'Manage configuration'
complete -c opta -n '__fish_use_subcommand' -a sessions -d 'Manage chat sessions'
complete -c opta -n '__fish_use_subcommand' -a mcp -d 'Model Context Protocol tools'
complete -c opta -n '__fish_use_subcommand' -a diff -d 'Show changes made in a session'
complete -c opta -n '__fish_use_subcommand' -a server -d 'Start HTTP API server'
complete -c opta -n '__fish_use_subcommand' -a daemon -d 'Manage Opta daemon runtime'
complete -c opta -n '__fish_use_subcommand' -a serve -d 'Manage remote Opta LMX server'
complete -c opta -n '__fish_use_subcommand' -a update -d 'Update Opta components locally/remotely'
complete -c opta -n '__fish_use_subcommand' -a completions -d 'Generate shell completions'

# Global flags (including chat TUI options)
complete -c opta -l verbose -d 'Detailed output'
complete -c opta -l debug -d 'Debug info including API calls'
complete -c opta -l version -s V -d 'Show version'
complete -c opta -l help -s h -d 'Show help'
complete -c opta -l resume -s r -d 'Resume session' -x
complete -c opta -l plan -d 'Plan mode'
complete -c opta -l review -d 'Code review mode'
complete -c opta -l research -d 'Research mode'
complete -c opta -l model -s m -d 'Override model' -x
complete -c opta -l format -s f -d 'Output format' -x -a 'text json'
complete -c opta -l no-commit -d 'Disable auto-commit'
complete -c opta -l no-checkpoints -d 'Disable checkpoints'
complete -c opta -l auto -s a -d 'Auto-accept file edits'
complete -c opta -l dangerous -d 'Bypass permission prompts'
complete -c opta -l yolo -d 'Alias for --dangerous'

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

# benchmark flags
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l output -s o -d 'Output directory' -r
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l query -d 'Override AI news query' -x
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l words -d 'Minimum AI news word count (>=500)' -x
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l max-results -d 'Max research results/citations' -x
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l provider-order -d 'Provider order (comma-separated)' -x
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l serve -d 'Serve benchmark over local HTTP'
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l host -d 'Host for benchmark server' -x
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l port -d 'Port for benchmark server' -x
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l force -d 'Allow existing output directory'
complete -c opta -n '__fish_seen_subcommand_from benchmark' -l json -d 'Machine-readable output'

# status flags
complete -c opta -n '__fish_seen_subcommand_from status' -l json -d 'Machine-readable output'

# models subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from models' -a 'list manage dashboard scan use info load unload swap stop alias aliases unalias download delete benchmark predictor helpers quantize agents skills rag health browse-local browse-library' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from models' -l json -d 'Machine-readable output'

# env subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from env' -a 'list show save use delete' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from env' -l host -d 'Override host when saving' -x
complete -c opta -n '__fish_seen_subcommand_from env' -l port -d 'Override port when saving' -x
complete -c opta -n '__fish_seen_subcommand_from env' -l admin-key -d 'Override admin key when saving' -x
complete -c opta -n '__fish_seen_subcommand_from env' -l model -d 'Override model when saving' -x
complete -c opta -n '__fish_seen_subcommand_from env' -l provider -d 'Provider for profile' -x -a 'lmx anthropic'
complete -c opta -n '__fish_seen_subcommand_from env' -l mode -d 'Default mode for profile' -x -a 'safe auto plan review research dangerous ci'
complete -c opta -n '__fish_seen_subcommand_from env' -l json -d 'Machine-readable output'

# config subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from config' -a 'list get set reset menu' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from config' -l json -d 'Machine-readable output'

# sessions subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from sessions' -a 'list resume delete export search' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from sessions' -l json -d 'Machine-readable output'

# mcp subcommands
complete -c opta -n '__fish_seen_subcommand_from mcp' -a 'add add-playwright remove test list' -d 'Action'
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

# daemon subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from daemon' -a 'start run stop status logs' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from daemon' -l host -d 'Bind host' -x
complete -c opta -n '__fish_seen_subcommand_from daemon' -l port -d 'Preferred port' -x
complete -c opta -n '__fish_seen_subcommand_from daemon' -l token -d 'Daemon token' -x
complete -c opta -n '__fish_seen_subcommand_from daemon' -l model -d 'Model override' -x
complete -c opta -n '__fish_seen_subcommand_from daemon' -l json -d 'Machine-readable output'

# serve subcommands and flags
complete -c opta -n '__fish_seen_subcommand_from serve' -a 'start stop restart logs' -d 'Action'
complete -c opta -n '__fish_seen_subcommand_from serve' -l json -d 'Machine-readable output'

# update flags
complete -c opta -n '__fish_seen_subcommand_from update' -l components -s c -d 'Components: cli,lmx,plus,web' -x -a 'cli lmx plus web'
complete -c opta -n '__fish_seen_subcommand_from update' -l target -s t -d 'Target: auto|local|remote|both' -x -a 'auto local remote both'
complete -c opta -n '__fish_seen_subcommand_from update' -l remote-host -d 'Override remote host' -x
complete -c opta -n '__fish_seen_subcommand_from update' -l remote-user -d 'Override SSH user' -x
complete -c opta -n '__fish_seen_subcommand_from update' -l identity-file -d 'Override SSH identity file' -r
complete -c opta -n '__fish_seen_subcommand_from update' -l local-root -d 'Override local apps root' -r
complete -c opta -n '__fish_seen_subcommand_from update' -l remote-root -d 'Override remote apps root' -x
complete -c opta -n '__fish_seen_subcommand_from update' -l dry-run -d 'Show planned commands without executing'
complete -c opta -n '__fish_seen_subcommand_from update' -l no-build -d 'Skip build/install/restart steps'
complete -c opta -n '__fish_seen_subcommand_from update' -l no-pull -d 'Skip git fetch/pull steps'
complete -c opta -n '__fish_seen_subcommand_from update' -l json -d 'Machine-readable output'

# completions subcommands
complete -c opta -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish' -d 'Shell'`;
}
