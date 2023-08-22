#!/usr/bin/env node

import inquirer from 'inquirer';
import request from 'superagent';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import fs from 'fs';
import branch from 'git-branch'; // included so it can be used from defaultFunction in config

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

const addChoicesFunctionSupport = (questions) => {
    return questions.map((q) => {
        if (q.choicesFunction) {
            q.choices = eval(q.choicesFunction)
        }
        return q
    })
}

const mapWhenFunctions = (questions) => {
    return questions.map((q) => {
        return {
            ...q,
            when: eval(q.when)
        }
    })
}

const loadFlow = (params) => {
    try {
        let rawdata = fs.readFileSync(params.config_file)
        var config = JSON.parse(rawdata)
        config.questions = addDefaultFunctionSupport(config.questions)
        config.questions = addChoicesFunctionSupport(config.questions)
        config.questions = mapWhenFunctions(config.questions)
        return config
    } catch (err) {
        console.log(err)
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

const updateActionWithAnswers = (action, answers, questions) => {
    return iterate(action, (value) => {
        Object.keys(answers).forEach((param) => {
            value = value.replace("{" + param + "}", answers[param])
        })

        // Check if value is an unfulfilled parameter (i.e. skipped by 'when')
        // and substitute with a default value if available
        const re = /(?<=\{).*(?=\})/
        const match = value.match(re)
        if (match) {
            const param = match[0]
            const q = questions.find(q => q.name == param)
            if (q != null && q.default != undefined) {
                if (typeof q.default === 'function') {
                    value = value.replace("{" + param + "}", q.default())
                } else {
                    value = value.replace("{" + param + "}", q.default)
                }
            }
        }

        return value
    })
}

const performAction = async (action) => {
    if (action.type !== 'http-request') {
        console.log("Unsupported action type " + action.type)
        process.exit(1)
    }
    try {
        var r = request(action.method, action.url)
        Object.keys(action.headers || {}).forEach(key => {
            r.set(key, action.headers[key])
        })
        return r.send(action.json_body)
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
    }, {
        name: 'debug',
        alias: 'd',
        type: Boolean,
        defaultValue: false,
        description: 'Debug mode to omit things like running the action.'
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
    try {
        const answers = await askQuestions(flow.questions)
        const action = updateActionWithAnswers(flow.action, answers, flow.questions)
        if (params.verbose) console.log('Performing action...\n' + JSON.stringify(action, null, 2))
        if (params.debug) { process.exit(0) }
        const result = await performAction(action)
        const response = result.res
        console.log('Response: ' + response.statusCode + ' ' + response.statusMessage + '\n' + response.text)
    } catch (err) {
        console.log(err.message)
        process.exit(1)
    }
};

run()