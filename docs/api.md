## API Reference

### Providers
Providers define *where* files come from. They expose `.all()` which returns a filterable `FileCollection`.

- `gitGet(repoUrl, { assetMatch?: RegExp, tag?: string })`
  Fetches a GitHub repository. If `assetMatch` is provided, it downloads that specific release asset. Otherwise, it downloads the source code tarball.
- `httpGet(url)`
  Downloads a direct URL (e.g., a `.zip` file or a single config file).
- `localGet(path)`
  References a local directory or file.

### Filtering (`FileCollection`)
Chain these methods onto `.all()`:
- `.only(pattern: string | RegExp)`: Include only files matching the pattern.
- `.remove(pattern: string | RegExp)`: Exclude files matching the pattern.

### Actions (`PackageBuilder`)
Passed as `ctx.package` inside your step callbacks. All methods are chainable.

- `.cd(relativePath)`: Change the internal working directory.
- `.copy(collection)`: Copy a file collection into the current directory.
- `.exec(command)`: Run a shell command in the current directory.
- `.remove(relativePath)`: Safely delete a file or folder inside the build directory.
- `.editJson(filename, mutatorFunction)`: Parses a JSON file, passes it to your function to mutate, and saves it.
- `.editYaml(filename, mutatorFunction)`: Parses a YAML file (requires `js-yaml` installed).

### Error Handling
If a step fails, the library provides a visual breakdown:
```text
[2/3] Modify Configuration... failed!
❌ Error in step [Modify Configuration]
   js-yaml not installed
   💡 Hint: Run: npm install js-yaml
```
