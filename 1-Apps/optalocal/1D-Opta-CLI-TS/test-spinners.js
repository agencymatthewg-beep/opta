const frames1 = ['◌', '◔', '◑', '◕', '●', '◕', '◑', '◔'];
const frames2 = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
const frames3 = ['◜', '◠', '◝', '◞', '◡', '◟'];
const frames4 = ['◴', '◷', '◶', '◵'];
const frames5 = ['◎', '◉', '●', '◉'];
const frames6 = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const frames7 = ['◐', '◓', '◑', '◒'];

async function play(frames, name) {
  process.stdout.write(name + ': ');
  for (let i = 0; i < frames.length * 3; i++) {
    process.stdout.write('\r' + name + ': ' + frames[i % frames.length]);
    await new Promise(r => setTimeout(r, 100));
  }
  console.log();
}

async function main() {
  await play(frames1, 'current');
  await play(frames2, 'dots2');
  await play(frames3, 'arc');
  await play(frames4, 'quarters');
  await play(frames5, 'pulse');
  await play(frames6, 'dots');
  await play(frames7, 'halves');
}
main();
