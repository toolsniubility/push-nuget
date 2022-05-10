# ✨ Publish NuGet

GitHub action to build, pack & publish nuget packages automatically when a project version is updated

## Usage

Create new `.github/workflows/publish.yml` file:

```yml
name: publish to nuget
on:
  push:
    branches:
      - master # Default release branch
jobs:
  publish:
    name: build, pack & publish
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      # - name: Setup dotnet
      #   uses: actions/setup-dotnet@v1
      #   with:
      #     dotnet-version: 6.0.0

      # Publish
      - name: Build Projects and Publish on Version Change
        id: publish_nuget_xx
        uses: niubilitytools/push-nuget@v1
        with:
          # Filepath of the project to be packaged, relative to root of repository
          project_file_path: Core/Core.csproj

          # NuGet package id, used for version detection & defaults to project name
          # package_name: Core

          # Useful with external providers like Nerdbank.GitVersioning, ignores
          #     `version_static` & `version_regex`
          # version_static: 1.0.0

          # Filepath with version info, relative to root of repository &
          #     defaults to `project_file_path`
          # version_file_path: Directory.Build.props

          # Regex pattern to extract version info in a capturing group
          # version_regex: ^\s*<Version>(.*)<\/Version>\s*$

          # Flag to toggle git tagging, enabled by default
          # tag_commit: true

          # Format of the git tag, [*] gets replaced with actual version
          # tag_format: v*

          # API key to authenticate with NuGet server
          nuget_key: ${{secrets.NUGET_API_KEY}}

          #  NuGet server uri hosting the packages, defaults to https://api.nuget.org
          # nuget_source: https://api.nuget.org

          # Flag to toggle pushing symbols along with nuget package to the server,
          #     disabled by default
          # include_symbols: false

          # Flag to set continue the next task when some error happened
          # include_symbols: false
          # Certificate file name (should be in root folder) to sign the package before upload
          # signing_cert_file_name: Core.cer
 
```

- Project gets published only if there's a `nuget_key` configured in the repository

## Inputs

Input | Default Value | Description
--- | --- | ---
project_file_path | | Filepath of the project to be packaged, relative to root of repository
package_name | | NuGet package id, used for version detection & defaults to project name
version_static| | Useful with external providers like Nerdbank.GitVersioning, ignores `version_static` & `version_regex`
version_static | `[project_file_path]` | Filepath with version info, relative to root of repository & defaults to project_file_path
version_regex | `^\s*<Version>(.*)<\/Version>\s*$` | Regex pattern to extract version info in a capturing group
tag_commit | `true` | Flag to toggle git tagging, enabled by default
tag_format | `v*` | Format of the git tag, `[*]` gets replaced with actual version
nuget_key | | API key to authenticate with NuGet server
nuget_source | `https://api.nuget.org` | NuGet server uri hosting the packages, defaults to <https://api.nuget.org>
include_symbols | `false` | Flag to toggle pushing symbols along with nuget package to the server, disabled by default
include_symbols  | `false` | Flag to set continue the next task when some error happened
signing_cert_file_name||Certificate file name (should be in root folder) to sign the package before upload
**FYI:**

- `nuget_source` must support `/v3-flatcontainer/package_name/index.json` for version change detection to work
- Multiple projects can make use of steps to configure each project individually, common inputs between steps can be given as `env` for [job / workflow](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#env)

## Outputs

Output | Description
--- | ---
version | Version of the associated git tag
package_name | Name of the NuGet package generated
package-path | Path to the generated NuGet package
symbols-package_name | Name of the symbols package generated
symbols-package-path | Path to the generated symbols package

**FYI:**

- Outputs may or may not be set depending on the action inputs or if the action failed

## License

[MIT](LICENSE)
