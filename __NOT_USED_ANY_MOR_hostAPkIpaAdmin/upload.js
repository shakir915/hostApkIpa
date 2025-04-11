
//run  command `node upload.js pageID apk_ipa_file_path`
//you may require to install node packages. firebase-admin app-info-parser firebase-admin/storage fs
//require serviceAccount json config  (firebase admin)
// change databaseURL & storageBucket


var admin = require("firebase-admin");
const AppInfoParser = require('/Users/shakir/PROJECTS/SHAKIR_PROJECTS/hostApkIpa/public/app-info-parser-1/lib/index.js');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');
var serviceAccount = require("./install4.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://install4-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: 'install4.appspot.com',
});
const bucket = getStorage().bucket();
var db = admin.database();

var data = {}
var pageID = process.argv[2]
getOldDBEntry(pageID)




function saveDB() {
  const usersRef = db.ref("/");
  usersRef.child(pageID).set(data);
  console.log(`\n\n\n`);
  console.log('URL', `https://install4.web.app/${pageID}`);
  console.log(`\n\n\n`);
  sleep(2)
  process.exit(0)
}


function makeid(length) {
  var result = '';
  var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}


function printProgress(progress) {

  if (process.stdout.clearLine) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
}

  process.stdout.write(" "+progress + '%');
}



function sleep(seconds) {
  var e = new Date().getTime() + (seconds * 1000);
  while (new Date().getTime() <= e) { }
}


async function uploadFile(filePath, fileType) {

  var filename = filePath.replace(/^.*[\\\/]/, '')
  console.log("filename " + filename + " " + fileType + " " + filePath)


  var stats = fs.statSync(filePath)
  var fileSizeInBytes = stats.size;

  const options = {
    destination: data["packageName"]+"_"+pageID + "/" + filename,
    preconditionOpts: {},
    public: true,
    onUploadProgress: progressEvent => printProgress(((progressEvent["bytesWritten"] / fileSizeInBytes) * 100))
  };

  try {
    bucket.upload(filePath, options, function (err, file, apiResponse) {
      try {
        if (err != null)
          console.log('err', err);
        var downloadURL = file["metadata"]["mediaLink"]
        if (downloadURL != null) {
          console.log('File available at', downloadURL);
          setDataKeyValue(fileType, downloadURL)
          setDataKeyValue("date", Date.now())
          if (fileType == "ipa") {
            var plistFilePath = filePath.replace(filename, "") + "manifest.plist"
            createPlist(plistFilePath)
          } else {
            saveDB()

          }
        }
      } catch (e) {
        console.log("e " + e)
      }



    });
  } catch (e) {
    console.log("e " + e)
  }




}

function parseFile(filePath) {
  console.log(filePath)
  setDataKeyValue("local_fileName", filePath)
  const parser = new AppInfoParser(filePath)
  parser.parse().then(result => {
    // console.log('app info ----> ', result)

    if (result["package"] != null) {
      parseAndroid(result)
      uploadFile(filePath, "apk")
    }
    if (result["CFBundleIdentifier"] != null) {
      parseIOS(result)
      uploadFile(filePath, "ipa")
    }





  }).catch(err => {
    console.log('err ----> ', err)
  })
}


function parseAndroid(result) {
  setDataKeyValue("versionName", result['versionName'])
  setDataKeyValue("packageName", result['package'])
  if (Array.isArray(result['application']['label']))
    setDataKeyValue("name", result['application']['label'][0])
  else
    setDataKeyValue("name", result['application']['label'])
  setDataKeyValue("icon", result.icon)
}

function parseIOS(result) {
  setDataKeyValue("versionName", result['CFBundleShortVersionString'])
  setDataKeyValue("packageName", result['CFBundleIdentifier'])
  var g_app_name = result['CFBundleDisplayName']
  if (g_app_name == null) {
    g_app_name = result['CFBundleName']
  }
  if (g_app_name == null) {
    g_app_name = result['CFBundleExecutable']
  }
  setDataKeyValue("name", g_app_name)
  setDataKeyValue("icon", result.icon)
  var pd = 0
  try {
    pd = result["mobileProvision"]["ProvisionedDevices"].length
  } catch (error) {
    console.log(error)
  }
  console.log("ProvisionedDevices " + pd)
  setDataKeyValue("ProvisionedDevices", pd)

  if (pd <= 0) process.exit()
}

function createPlist(fileName) {
  var plistContent =
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string><![CDATA[YOUR_IPA_URL_HERE]]></string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>YOUR_IPA_BUNDLE_ID_HERE</string>
        <key>bundle-version</key>
        <string>YOUR_VERSION_HERE</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>YOUR_IPA_APP_NAME_HERE</string>
        <key>subtitle</key>
        <string></string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`
  plistContent = plistContent.replace("YOUR_IPA_URL_HERE", data["ipa"])
    .replace("YOUR_VERSION_HERE", data["versionName"])
    .replace("YOUR_IPA_BUNDLE_ID_HERE", data["packageName"])
    .replace("YOUR_IPA_APP_NAME_HERE", data["name"])




  try {
    fs.writeFileSync(fileName, plistContent);
    // file written successfully
    uploadFile(fileName, "plist")
  } catch (err) {
    console.error(err);
  }



}



function getOldDBEntry(k) {

  var ref = db.ref(k);
  ref.once("value", function (snapshot) {
    console.log("get OLD" + snapshot.val());
    snapshot.forEach(function (childSnapshot) {
      var childKey = childSnapshot.key;
      var childData = childSnapshot.val();
      if (childKey != null && childData != null) {
        setDataKeyValue(childKey, childData)
      }




    })


    parseFile(process.argv[3])


  });
}


function setDataKeyValue(k, v) {
  if (k != null && v != null) {
    data[k] = v
  }
}






