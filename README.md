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
            "name": "RELEASE_TYPE",
            "type": "list",
            "choices": [
                "New",
                "Update"
            ],
            "when": "(answers) => answers['BUILD_TARGET'] == 'Inhouse'"
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
Note that not all values outlined in the format is directly supported. The values supported without any special work are those who are limited to a simple type only, such as strings, numbers or booleans.
A few values support functions as well however there are some special cases such as `default` and `choices` where the spec is a little different from inquirer's that you can read about below. Do note that the different approach **only** applies when the value has multiple types including a function.

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

### Dynamic choices with choicesFunction
Like `defaultFunction` it is also possible to provide choices as a result of a function. This is done by setting `choicesFunction` instead of `choices` and provide a function that returns an array of strings. Keep in mind however that the function is run when the config file is first parsed. This means the function is limited to computing the choices before the questions are asked.
```
{
    "name": "TESTERS",
    "type": "checkbox",
    "choicesFunction": "() => JSON.parse(fs.readFileSync('app.config')).testers"
}
```
