const { spawn } = require('child_process');
//--target-platform=android-arm,android-arm64


const args = process.argv.slice(2); // this gets only the arguments passed in

var currentDirectory = args[0]; // $PWD from the shell script
const firstArgument = args[1];    // $1 from the shell script
const otherArgs = args.slice(2);

var UPLD=`node "/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/upload-bot/upload.js"`;
var commandString = ""

if(currentDirectory.endsWith("/27jezly-user")||firstArgument=="jezly"){
  if(firstArgument=="jezly")
    currentDirectory="/Users/shakir/PROJECTS/Emstell/27jezly-user";
var plist= "/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/upload-bot/exportOptionPlists/jezly_ExportOptions.plist";
commandString=`
cd "${currentDirectory}" && flutter clean
cd "${currentDirectory}" && rm -f "./build/ios/ipa/27Jezly.ipa"  && flutter build ipa  --dart-define=BACKEND=qa  --export-method=ad-hoc
cd "${currentDirectory}" && ${UPLD} 27JezlyQA "./build/ios/ipa/27Jezly.ipa"
cd "${currentDirectory}" && rm -f "./build/ios/ipa/27Jezly.ipa"  && flutter build ipa  --dart-define=BACKEND=prod  --export-method=ad-hoc
cd "${currentDirectory}" && ${UPLD} 27Jezly "./build/ios/ipa/27Jezly.ipa"
cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=BACKEND=qa  --target-platform=android-arm64
cd "${currentDirectory}" && ${UPLD} 27JezlyQA "./build/app/outputs/flutter-apk/app-release.apk"
cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=BACKEND=prod  --target-platform=android-arm64
cd "${currentDirectory}" && ${UPLD} 27Jezly "./build/app/outputs/flutter-apk/app-release.apk"
say completed
`;
}



if(currentDirectory.endsWith("/27jezlyBusiness")||firstArgument=="jezlyb"){
  if(firstArgument=="jezlyb")
    currentDirectory="/Users/shakir/PROJECTS/Emstell/27jezlyBusiness";
var plist= "/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/upload-bot/exportOptionPlists/jezly_ExportOptions.plist";
commandString=`
cd "${currentDirectory}" && flutter clean
cd "${currentDirectory}" && rm -f "./build/ios/ipa/27Jezly Business.ipa"  && flutter build ipa  --dart-define=BACKEND=qa  --export-method=ad-hoc
cd "${currentDirectory}" && ${UPLD} 27JezlyBusinessQA "./build/ios/ipa/27Jezly Business.ipa"
cd "${currentDirectory}" && rm -f "./build/ios/ipa/27Jezly Business.ipa"  && flutter build ipa  --dart-define=BACKEND=prod   --export-method=ad-hoc
cd "${currentDirectory}" && ${UPLD} 27JezlyBusiness "./build/ios/ipa/27Jezly Business.ipa"
cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=BACKEND=qa --target-platform=android-arm64
cd "${currentDirectory}" && ${UPLD} 27JezlyBusinessQA "./build/app/outputs/flutter-apk/app-release.apk"
cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=BACKEND=prod  --target-platform=android-arm64
cd "${currentDirectory}" && ${UPLD} 27JezlyBusiness "./build/app/outputs/flutter-apk/app-release.apk"
say completed
`;
}

if(currentDirectory.endsWith("/salem-apps-mobile")||firstArgument=="salem"){
  if(firstArgument=="salem")
    currentDirectory="/Users/shakir/PROJECTS/Emstell/salem-apps-mobile";
var plist= "/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/upload-bot/exportOptionPlists/jezly_ExportOptions.plist";
commandString=`
cd "${currentDirectory}" && flutter clean
cd "${currentDirectory}" && rm -f "./build/ios/ipa/salem.ipa"  && flutter build ipa  --export-method=ad-hoc
cd "${currentDirectory}" && ${UPLD} salem "./build/ios/ipa/salem.ipa"

cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=BACKEND=qa --target-platform=android-arm64
cd "${currentDirectory}" && ${UPLD} salem "./build/app/outputs/flutter-apk/app-release.apk"

say completed
`;
}


if(currentDirectory.endsWith("/yourbillboard-app")||firstArgument=="billboard"){
  if(firstArgument=="billboard")
    currentDirectory="/Users/shakir/PROJECTS/Emstell/yourbillboard-app";
var plist= "/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/upload-bot/exportOptionPlists/jezly_ExportOptions.plist";
commandString=`
cd "${currentDirectory}" && flutter clean
cd "${currentDirectory}" && rm -f "./build/ios/ipa/your_billboard.ipa"  && flutter build ipa   --export-method=ad-hoc
cd "${currentDirectory}" && ${UPLD} billboard "./build/ios/ipa/your_billboard.ipa"

cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=BACKEND=qa --target-platform=android-arm64
cd "${currentDirectory}" && ${UPLD} billboard "./build/app/outputs/flutter-apk/app-release.apk"

say completed
`;
}



if(currentDirectory.endsWith("/Talat")||firstArgument=="talat"){
  if(firstArgument=="talat")
    currentDirectory="/Users/shakir/PROJECTS/Emstell/Talat";
var plist= "/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/upload-bot/exportOptionPlists/talat_ExportOptions.plist";
commandString=`
cd "${currentDirectory}" && flutter clean
cd "${currentDirectory}" && rm -f "./build/ios/ipa/talat.ipa"  && flutter build ipa  --dart-define=key=value  --export-method=ad-hoc
cd "${currentDirectory}" && ${UPLD} talat "./build/ios/ipa/talat.ipa"

cd "${currentDirectory}" && rm -f "./build/app/outputs/flutter-apk/app-release.apk"  && flutter build apk  --dart-define=key=value --target-platform=android-arm64
cd "${currentDirectory}" && ${UPLD} talat "./build/app/outputs/flutter-apk/app-release.apk"

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
