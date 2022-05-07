const os = require("os"),
  fs = require("fs"),
  path = require("path"),
  https = require("https"),
  spawnSync = require("child_process").spawnSync,
  core = require("@actions/core");

class Action {
  constructor() {
    this.projectFile = core.getInput("PROJECT_FILE_PATH");
    this.packageName = core.getInput("PACKAGE_NAME");
    this.versionFile = core.getInput("VERSION_FILE_PATH") || this.projectFile;
    this.versionRegex = new RegExp(core.getInput("VERSION_REGEX"), "m");
    this.version = core.getInput("VERSION_STATIC");
    this.tagCommit = core.getBooleanInput("TAG_COMMIT");
    this.tagFormat = core.getInput("TAG_FORMAT");
    this.nugetKey = core.getInput("NUGET_KEY");
    this.nugetSource = core.getInput("NUGET_SOURCE");
    this.includeSymbols = core.getBooleanInput("INCLUDE_SYMBOLS");
    this.errorContinue = core.getBooleanInput("ERROR_CONTINUE");
    this.noBuild = core.getBooleanInput("NO_BUILD");
    this.signingCert = core.getInput("SIGNING_CERT_FILE_NAME");
  }

  _validateInputs() {
    // make sure we don't have badly configured version flags
    let errorMessage = [];

    if (!this.projectFile || !fs.existsSync(this.projectFile)) errorMessage.push(`Project file '${this.projectFile}' not found`);

    if (!this.nugetKey) errorMessage.push(`You must setup the token 'NUGET_KEY'.`);

    if (this.version && this.versionFile) core.warning("You provided 'version', extract-* keys are being ignored.");
    if (this.signingCert && !fs.existsSync(this.signingCert)) errorMessage.push(`Must setup correct 'SIGNING_CERT_FILE_NAME', signing file '${this.signingCert}' not found`);
    if (!this.version) {
      if (!this.versionFile || !fs.existsSync(this.versionFile)) {
        errorMessage.push(`Must setup correct 'VERSION_FILE_PATH' when not set 'VERSION_STATIC', version file '${this.versionFile}' not found`);
      } else if (!this.versionRegex) {
        errorMessage.push(`Must setup correct RegExp to 'VERSION_REGEX, current is '${core.getInput("VERSION_REGEX")}'`);
      }
      const versionFileContent = fs.readFileSync(this.versionFile, { encoding: "utf-8" }),
        parsedVersion = this.versionRegex.exec(versionFileContent);

      if (!parsedVersion || parsedVersion.length == 1) {
        errorMessage.push(`Unable to extract version info! Regex:'${core.getInput("VERSION_REGEX")}', Version File:'${this.versionFile}'`);
      } else {
        this.version = parsedVersion[1];
      }
    }
    if (errorMessage.length > 0) {
      errorMessage.forEach((er) => {
        core.error(er);
      });
      this._printErrorAndExit("quit due to errors above.");
    }
  }

  _printErrorAndExit(msg) {
    core.error(`😭 ${msg}`);
    throw new Error(msg);
  }

  _printError(msg) {
    if (this.errorContinue) {
      core.warning(`😢 ${msg}`);
    } else {
      core.error(`😭 ${msg}`);
      throw new Error(msg);
    }
  }

  _executeCommand(cmd, options) {
    core.info(`executing: [${cmd}]`);

    const INPUT = cmd.split(" "),
      TOOL = INPUT[0],
      ARGS = INPUT.slice(1);
    return spawnSync(TOOL, ARGS, options);
  }

  _executeInProcess(cmd) {
    this._executeCommand(cmd, { encoding: "utf-8", stdio: [process.stdin, process.stdout, process.stderr] });
  }

  _tagCommit(version) {
    const TAG = this.tagFormat.replace("*", version);

    core.info(`✨ creating new tag ${TAG}`);

    this._executeInProcess(`git tag ${TAG}`);
    this._executeInProcess(`git push origin ${TAG}`);

    process.stdout.write(`::set-output name=VERSION::${TAG}` + os.EOL);
  }

  _generatePackArgs() {
    var args = `--no-build -c Release -p:PackageVersion=${this.version} ${this.includeSymbols ? "--include-symbols -p:SymbolPackageFormat=snupkg" : ""} --no-build -c Release`;

    return args;
  }
  _pushPackage(version, name) {
    core.info(`✨ found new version (${version}) of ${name}`);

    // if (this.sourceType == 'NuGet' && !this.nugetKey) {
    //   core.warning('😢 NUGET_KEY not given')
    //   return
    // }

    core.info(`NuGet Source: ${this.nugetSource}`);

    fs.readdirSync(".")
      .filter((fn) => /\.s?nupkg$/.test(fn))
      .forEach((fn) => fs.unlinkSync(fn));

    if (!this.noBuild) this._executeInProcess(`dotnet build -c Release ${this.projectFile} /p:Version=${this.version}`);

    this._executeInProcess(`dotnet pack ${this._generatePackArgs()} ${this.projectFile} -o .`);

    const packages = fs.readdirSync(".").filter((fn) => fn.endsWith("nupkg"));
    core.info(`Generated Package(s): ${packages.join(", ")}`);

    packages
      .filter((p) => p.endsWith(".nupkg"))
      .forEach((nupkg) => {
        if (this.signingCert) this._executeInProcess(`dotnet nuget sign ${nupkg} -CertificatePath ${this.signingCert} -Timestamper http://timestamp.digicert.com`);

        const pushCmd = `dotnet nuget push ${nupkg} -s ${this.nugetSource}/v3/index.json -k ${this.nugetKey} --skip-duplicate${!this.includeSymbols ? " -n" : ""}`,
          pushOutput = this._executeCommand(pushCmd, { encoding: "utf-8" }).stdout;
        core.info(pushOutput);

        if (/error/.test(pushOutput)) this._printErrorAndExit(`${/error.*/.exec(pushOutput)[0]}`);

        const symbolsFilename = nupkg.replace(".nupkg", ".snupkg"),
          fullpathsymbolsFilename = path.resolve(symbolsFilename);

        process.stdout.write(`::set-output name=PACKAGE_NAME::${nupkg}` + os.EOL);
        process.stdout.write(`::set-output name=PACKAGE_PATH::${path.resolve(nupkg)}` + os.EOL);

        if (symbolsFilename) {
          if (fs.existsSync(fullpathsymbolsFilename)) {
            process.stdout.write(`::set-output name=SYMBOLS_PACKAGE_NAME::${symbolsFilename}` + os.EOL);
            process.stdout.write(`::set-output name=SYMBOLS_PACKAGE_PATH::${fullpathsymbolsFilename}` + os.EOL);
          } else {
            core.warning(`supkg [${symbolsFilename}] is not existed. path:[${fullpathsymbolsFilename}]`);
          }
        }
      });

    if (this.tagCommit) this._tagCommit(version);
  }

  _checkForUpdate() {
    if (!this.packageName) {
      this.packageName = path.basename(this.projectFile).split(".").slice(0, -1).join(".");
    }

    core.info(`Package Name: ${this.packageName}`);

    let versionCheckUrl, options;
    // toLowerCase() for url  is resoving a bug of nuget
    versionCheckUrl = `${this.nugetSource}/v3-flatcontainer/${this.packageName}/index.json`.toLowerCase();
    options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36 Edg/100.0.1185.44",
      },
    };

    core.info(`Url of checking Version: ${versionCheckUrl}`);

    https
      .get(versionCheckUrl, options, (res) => {
        let body = "";
        if (res.statusCode == 200) {
          res.setEncoding("utf8");
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            const existingVersions = JSON.parse(body);
            if (existingVersions.versions.indexOf(this.version) < 0) {
              // core.info(`Current version ${this.version} is not found in NuGet. Versions:${existingVersions.versions}`)
              this._pushPackage(this.version, this.packageName);
            } else core.warning(`Stop pulishing, found the version on: ${this.nugetSource.replace("api.", "")}/packages/${this.packageName}/${this.version}`);
          });
        } else if (res.statusCode == 404) {
          core.warning(`Url '${versionCheckUrl}' is not available now or '${this.packageName}' was never uploaded on NuGet`);
          this._pushPackage(this.version, this.packageName);
        } else {
          this._printErrorAndExit(`error: ${res.statusCode}: ${res.statusMessage}`);
        }
      })
      .on("error", (e) => {
        this._printErrorAndExit(`error: ${e.message}`);
      });
  }

  run() {
    this._validateInputs();

    core.info(`Version: ${this.version}`);

    this._checkForUpdate();
  }
}

new Action().run();
