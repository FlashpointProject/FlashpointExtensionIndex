# Flashpoint Launcher Extensions Index

### Using the Index

Add index json url to your Manager settings

`https://raw.githubusercontent.com/FlashpointProject/FlashpointExtensionIndex/refs/heads/main/extindex.json`

### Adding an Extension

Add your repository URL to `repositories.json` under your author subsection.

```json
{
  "repositories": {
    "FlashpointArchive": [
      "https://github.com/FlashpointProject/FPL-Analytics"
    ]
  }
}
```

Make a pull request with this new repo.