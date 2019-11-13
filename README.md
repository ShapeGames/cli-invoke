# cli-invoke
Interactive command line tool (written in Node.js) that will ask questions defined in a configuration file and invoke a web hook based on the user's answers.

In your `cli-invoke-config.json` file you specify the questions you want to get prompted when you run `cli-invoke`. You also specify the URL to invoke and the template for the JSON body to post.

## Installation

```
$ npm install -g cli-invoke
```

## Usage
Make sure you have your `cli-invoke-config.json` file in the current directory or use the `--config` flag to specify an alternative location or file name.

The format of your `cli-invoke-config.json` file should be similar to this example
```
{
    "questions": [{
            "name": "BUILD_CONFIGURATION",
            "type": "list",
            "choices": [
                "MyBuildConfig1",
                "MyBuildConfig1",
                "MyBuildConfig1",
            ]
        },
        {
            "name": "BUILD_TARGET",
            "type": "list",
            "choices": [
                "Inhouse",
                "Kiosk",
                "AppStore"
            ]
        },
        {
            "name": "RELEASE_NOTE",
            "type": "editor"
        }
    ],
    "action": {
        "type": "http-request",
        "url": "https://app.bitrise.io/app/[redacted]/build/start.json",
        "method": "POST",
        "json_body": {
            "hook_info": {
                "type": "bitrise",
                "build_trigger_token": "[redacted]"
            },
            "build_params": {
                "branch": "development",
                "commit_message": "{RELEASE_NOTE}",
                "environments": [{
                        "mapped_to": "BUILD_CONFIGURATION",
                        "value": "{BUILD_CONFIGURATION}",
                        "is_expand": true
                    },
                    {
                        "mapped_to": "BUILD_TARGET",
                        "value": "{BUILD_TARGET}",
                        "is_expand": true
                    }
                ]
            },
            "triggered_by": "cli-invoke"
        }
    }
}
```

The questions should be defined in the format of the [inquirer](https://github.com/SBoudrias/Inquirer.js) module. The possible question types are `input`, `number`, `confirm`, `list`, `rawlist`, `expand`, `checkbox`, `password`, `editor`.

The action to perform after gathering your answers for all questions is defined in the `action` object. Currently the only supported action type is `http-request`. Placeholder values enclosed in curly braces such as `{BUILD_CONFIGURATION}` will be replaced by the answer to the question with that name.

### Dynamic default values with defaultFunction
It can be useful to prefil default values for questions in a dynamic way. E.g. use the current git branch or the contents of a file. The [inquirer](https://github.com/SBoudrias/Inquirer.js) format for defining questions support that a default value can be specified as a javascript function, but since the config file is in JSON format the function has to be passed as a string. This is possible by setting the `defaultFunction` property as a string containing a javascript function. A few examples:

```
{
    "name": "BRANCH",
    "type": "input",
    "defaultFunction": "() => branch.sync()"
},
{
    "name": "RELEASE_NOTE",
    "type": "editor",
    "defaultFunction": "() => fs.readFileSync('release_notes.txt')"
}
```