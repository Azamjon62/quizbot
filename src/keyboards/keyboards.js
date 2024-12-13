import keyboardNames from './keyboard-names.all.js'
import { readFileCustom } from '../helpers/read.helper.js'

const allQuizzes = readFileCustom('quizzDate.json')

// console.log(allQuizzes);




export default {
    starting: [
        [keyboardNames.newTest],
        [keyboardNames.getTests],
    ]
}