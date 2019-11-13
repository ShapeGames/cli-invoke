#!/usr/bin/env node

const inquirer = require('inquirer')
const request = require('superagent')
const commandLineArgs = require('command-line-args')
const fs = require('fs')
const commandLineUsage = require('command-line-usage')
const branch = require('git-branch') // included so it can be used from defaultFunction in config

const askQuestions = async (questions) => {
    const answers = await inquirer.prompt(questions)
    console.log(answers)
    return answers
}

const addDefaultFunctionSupport = (questions) => {
    return questions.map((q) => {
        if (q.defaultFunction) {
            q.default = eval(q.defaultFunction)
        }
        return q
    })
}
const loadFlow = (params) => {
    try {
        let rawdata = fs.readFileSync(params.config_file)
        var config = JSON.parse(rawdata)
        config.questions = addDefaultFunctionSupport(config.questions)
        return config
    } catch (err) {
        console.log('Could not read the config file ' + params.config_file)
        process.exit(1)
    }
}

const iterate = (obj, valueMap) => {
    if (Array.isArray(obj)) {
        return obj.map((el) => iterate(el, valueMap))
    }
    var res = {}
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object') {
            res[key] = iterate(obj[key], valueMap)
        } else if (typeof obj[key] === 'string') {
            res[key] = valueMap(obj[key])
        } else {
            res[key] = obj[key]
        }
    })
    return res
}

const updateActionWithAnswers = (action, answers) => {
    return iterate(action, (value) => {
        Object.keys(answers).forEach((param) => {
            value = value.replace("{" + param + "}", answers[param])
        })
        return value
    })
}

const performAction = async (action) => {
    if (action.type !== 'http-request') {
        console.log("Unsupported action type " + action.type)
        process.exit(1)
    }
    try {
        return request(action.method, action.url).send(action.json_body)
    } catch (err) {
        console.log("Error making request: " + err)
    }
}

const optionDefinitions = [{
        name: 'config_file',
        alias: 'c',
        type: String,
        defaultOption: true,
        defaultValue: 'cli-invoke-config.json',
        typeLabel: '{underline file}',
        description: 'The JSON file with the definition of questions and action. Will look for cli-invoke-config.json in the current dir if not specified.'
    }, {
        name: 'help',
        alias: 'h',
        type: Boolean,
        defaultValue: false,
        description: 'To print this usage instruction'
    }, {
        name: 'verbose',
        alias: 'v',
        type: Boolean,
        defaultValue: false,
        description: 'Make more noise'
    },
]

const parseParameters = () => {
    return commandLineArgs(optionDefinitions)
}

const printUsageInstructions = () => {
    const sections = [{
            header: 'cli-invoke',
            content: 'cli-invoke will ask questions defined in a configuration file and invoke a web hook based on your answers'
        },
        {
            header: 'Options',
            optionList: optionDefinitions
        }
    ]
    const usage = commandLineUsage(sections)
    console.log(usage)
}

const run = async () => {
    const params = parseParameters()
    if (params.help) {
        printUsageInstructions()
        return process.exit(0)
    }
    const flow = loadFlow(params)
    const answers = await askQuestions(flow.questions)
    const action = updateActionWithAnswers(flow.action, answers)
    if (params.verbose) console.log('Performing action...\n' + JSON.stringify(action))
    const result = await performAction(action)
    const response = result.res
    console.log('Response: ' + response.statusCode + ' ' + response.statusMessage + '\n' + response.text)
};

run()