const { spawn } = require('child_process');



const args = process.argv.slice(2); // this gets only the arguments passed in

var currentDirectory = args[0]; // $PWD from the shell script
const firstArgument = args[1];    // $1 from the shell script
const otherArgs = args.slice(2);

var UPLD=`node "/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/upload-bot/upload.js"`;
var commandString = ""

if(currentDirectory.endsWith("/jezly")||firstArgument=="jezly"){
  if(firstArgument=="jezly")
    currentDirectory="/Users/shakir/PROJECTS/Emstell/27jezly-user/jezly";
var plist= "/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/upload-bot/exportOptionPlists/jezly_ExportOptions.plist";
commandString=`
cd "${currentDirectory}" && rm -f "./build/ios/ipa/27Jezly.ipa"  && flutter build ipa  --dart-define=qa=true --export-options-plist="${plist}" 
cd "${currentDirectory}" && ${UPLD} jezly_qa "./build/ios/ipa/27Jezly.ipa"
cd "${currentDirectory}" && rm -f "./build/ios/ipa/27Jezly.ipa"  && flutter build ipa  --dart-define=qa=false --export-options-plist="${plist}"
cd "${currentDirectory}" && ${UPLD} jezly_prod "./build/ios/ipa/27Jezly.ipa"
cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=qa=true  
cd "${currentDirectory}" && ${UPLD} jezly_qa "./build/app/outputs/flutter-apk/app-release.apk"
cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=qa=false  
cd "${currentDirectory}" && ${UPLD} jezly_prod "./build/app/outputs/flutter-apk/app-release.apk"
say completed
`;
}


if(currentDirectory.endsWith("hostApkIpa")&&firstArgument=="upload"){
commandString=`
cd "${currentDirectory}" && firebase deploy --only hosting   --force" 
`;
}


// Split the command by line
const commands = commandString.trim().split('\n');

// Execute the commands sequentially
let currentCommandIndex = 0;

function runCommand() {
    if (currentCommandIndex >= commands.length) return;
  
    const command = commands[currentCommandIndex].trim();
  
    if (command) {
      const [cmd, ...args] = command.split(' ');
  
      const process = spawn(cmd, args, {
        stdio: 'inherit', // <- this preserves colors!
        shell: true
      });
  
      process.on('close', (code) => {
        if(code != 0)
            console.log(`Command "${command}" finished with exit code ${code}`);
        currentCommandIndex++;
        runCommand();
      });
    } else {
      currentCommandIndex++;
      runCommand();
    }
  }
runCommand();
