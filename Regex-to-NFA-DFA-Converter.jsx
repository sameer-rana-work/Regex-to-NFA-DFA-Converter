const { useState, useEffect, useRef } = React;

// State and NFA/DFA Classes
class State {
    constructor() {
        this.id = State.nextId++;
        this.transitions = {};
        this.epsilon = new Set();
    }
    toString() {
        return `q${this.id}`;
    }
}
State.nextId = 0;

class NFA {
    constructor(start, accept, transitions = {}) {
        this.start = start;
        this.accept = accept;
        this.transitions = transitions;
    }
}

class DFA {
    constructor(start, acceptStates, transitions) {
        this.start = start;
        this.acceptStates = acceptStates;
        this.transitions = transitions; // Map<State, {symbol: State}>
    }
}

// Regex Validation
function validateRegex(regex) {
    try {
        let stack = [];
        let lastChar = null;
        for (let i = 0; i < regex.length; i++) {
            let char = regex[i];
            if (char === '(') stack.push(char);
            else if (char === ')') {
                if (!stack.length) return [false, "Unbalanced parentheses: too many closing parentheses"];
                stack.pop();
            }
            if (['*', '+', '?', '|'].includes(char) && ['*', '+', '?', '|'].includes(lastChar)) {
                return [false, `Invalid consecutive operators at position ${i}`];
            }
            if (char === ')' && lastChar === '(') {
                return [false, "Empty parentheses not allowed"];
            }
            lastChar = char;
        }
        if (stack.length) return [false, "Unbalanced parentheses: unclosed parentheses"];
        const validChars = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789|*+?().');
        if (![...regex].every(c => validChars.has(c))) return [false, "Invalid characters in regex"];
        if (!regex) return [false, "Regex cannot be empty"];
        return [true, ""];
    } catch (e) {
        return [false, `Validation error: ${e}`];
    }
}

// Infix to Postfix Conversion
function insertConcat(regex) {
    let output = "";
    const ops = new Set(['*', '+', '?', '|', '(', ')']);
    for (let i = 0; i < regex.length; i++) {
        output += regex[i];
        if (i + 1 < regex.length) {
            const curr = regex[i];
            const next = regex[i + 1];
            if ((curr.match(/[a-zA-Z0-9]/) || curr === ')') && (next.match(/[a-zA-Z0-9]/) || next === '(')) {
                output += '.';
            } else if (curr === ')' && ops.has(next)) {
                output += '.';
            }
        }
    }
    return output;
}

function infixToPostfix(regex) {
    const precedence = { '*': 3, '+': 3, '?': 3, '.': 2, '|': 1 };
    let output = [];
    let stack = [];
    for (let char of regex) {
        if (/[a-zA-Z0-9]/.test(char)) {
            output.push(char);
        } else if (char === '(') {
            stack.push(char);
        } else if (char === ')') {
            while (stack.length && stack[stack.length - 1] !== '(') {
                output.push(stack.pop());
            }
            stack.pop(); // Remove '('
            if (stack.length && ['*', '+', '?'].includes(stack[stack.length - 1])) {
                output.push(stack.pop());
            }
        } else {
            while (stack.length && stack[stack.length - 1] !== '(' && precedence[char] <= precedence[stack[stack.length - 1]]) {
                output.push(stack.pop());
            }
            stack.push(char);
        }
    }
    while (stack.length) {
        if (stack[stack.length - 1] !== '(') {
            output.push(stack.pop());
        }
    }
    return output.join('');
}

// Thompson's Construction
function regexToNFA(postfix) {
    let stack = [];

    function basic(symbol) {
        const s = new State(), a = new State();
        s.transitions[symbol] = new Set([a]);
        return new NFA(s, a, { [s]: { [symbol]: new Set([a]) } });
    }

    for (let c of postfix) {
        if (c.match(/[a-zA-Z0-9]/)) {
            stack.push(basic(c));
        } else if (c === '*') {
            const nfa = stack.pop();
            const s = new State(), a = new State();
            s.epsilon.add(nfa.start);
            s.epsilon.add(a);
            nfa.accept.epsilon.add(nfa.start);
            nfa.accept.epsilon.add(a);
            const transitions = {
                ...nfa.transitions,
                [s]: { 'ε': new Set([nfa.start, a]) },
                [nfa.accept]: { 'ε': new Set([nfa.start, a]) }
            };
            stack.push(new NFA(s, a, transitions));
        } else if (c === '+') {
            const nfa = stack.pop();
            const s = new State(), a = new State();
            s.epsilon.add(nfa.start);
            nfa.accept.epsilon.add(nfa.start);
            nfa.accept.epsilon.add(a);
            const transitions = {
                ...nfa.transitions,
                [s]: { 'ε': new Set([nfa.start]) },
                [nfa.accept]: { 'ε': new Set([nfa.start, a]) }
            };
            stack.push(new NFA(s, a, transitions));
        } else if (c === '?') {
            const nfa = stack.pop();
            const s = new State(), a = new State();
            s.epsilon.add(nfa.start);
            s.epsilon.add(a);
            nfa.accept.epsilon.add(a);
            const transitions = {
                ...nfa.transitions,
                [s]: { 'ε': new Set([nfa.start, a]) },
                [nfa.accept]: { 'ε': new Set([a]) }
            };
            stack.push(new NFA(s, a, transitions));
        } else if (c === '|') {
            const n2 = stack.pop(), n1 = stack.pop();
            const s = new State(), a = new State();
            s.epsilon.add(n1.start);
            s.epsilon.add(n2.start);
            n1.accept.epsilon.add(a);
            n2.accept.epsilon.add(a);
            const transitions = {
                ...n1.transitions,
                ...n2.transitions,
                [s]: { 'ε': new Set([n1.start, n2.start]) },
                [n1.accept]: { 'ε': new Set([a]) },
                [n2.accept]: { 'ε': new Set([a]) }
            };
            stack.push(new NFA(s, a, transitions));
        } else if (c === '.') {
            const n2 = stack.pop(), n1 = stack.pop();
            n1.accept.epsilon.add(n2.start);
            const transitions = { ...n1.transitions, ...n2.transitions };
            transitions[n1.accept] = { 'ε': new Set([n2.start]) };
            // Merge all transitions from n2
            for (let state in n2.transitions) {
                if (!transitions[state]) transitions[state] = {};
                for (let sym in n2.transitions[state]) {
                    transitions[state][sym] = n2.transitions[state][sym];
                }
            }
            stack.push(new NFA(n1.start, n2.accept, transitions));
        }
    }
    if (stack.length !== 1) {
        console.error("NFA construction failed: stack length mismatch", stack);
    }
    return stack.pop();
}

// NFA to DFA Conversion (Subset Construction)
function epsilonClosure(states, transitions) {
    const stack = [...states];
    const closure = new Set(states);
    while (stack.length) {
        const state = stack.pop();
        if (transitions[state]) {
            for (let sym in transitions[state]) {
                for (let next of (transitions[state][sym] || new Set())) {
                    if (!closure.has(next)) {
                        closure.add(next);
                        stack.push(next);
                    }
                }
            }
        }
        for (let next of state.epsilon) {
            if (!closure.has(next)) {
                closure.add(next);
                stack.push(next);
            }
        }
    }
    return closure;
}

function nfaToDFA(nfa) {
    const transitionFunction = nfa.transitions;
    const alphabet = Object.keys(transitionFunction).flatMap(state =>
        Object.keys(transitionFunction[state]).filter(sym => sym !== 'ε')
    ).filter((sym, i, arr) => arr.indexOf(sym) === i); // Unique alphabet

    const stateSets = new Map();     // key string → Set<NFA states>
    const dfaStateMap = new Map();   // key string → new State()
    const dfaTransitions = new Map(); // DFA State → {symbol: DFA State}
    const acceptStates = new Set();

    const startSet = epsilonClosure(new Set([nfa.start]), transitionFunction);
    const startKey = [...startSet].map(s => s.toString()).sort().join(',');
    stateSets.set(startKey, startSet);

    const startDfa = new State();
    dfaStateMap.set(startKey, startDfa);
    const queue = [startKey];

    if (startSet.has(nfa.accept)) acceptStates.add(startDfa);

    while (queue.length) {
        const key = queue.shift();
        const currSet = stateSets.get(key);
        const currDfa = dfaStateMap.get(key);
        dfaTransitions.set(currDfa, {});

        for (const sym of alphabet) {
            const reach = new Set();
            for (const st of currSet) {
                const next = transitionFunction[st]?.[sym] || new Set();
                next.forEach(x => reach.add(x));
            }
            const newSet = epsilonClosure(reach, transitionFunction);
            const newKey = [...newSet].map(s => s.toString()).sort().join(',');

            let targetDfa;
            if (newSet.size > 0 && !dfaStateMap.has(newKey)) {
                targetDfa = new State();
                dfaStateMap.set(newKey, targetDfa);
                stateSets.set(newKey, newSet);
                queue.push(newKey);
                if (newSet.has(nfa.accept)) acceptStates.add(targetDfa);
            } else if (newSet.size === 0) {
                const deadKey = 'DEAD';
                if (!dfaStateMap.has(deadKey)) {
                    const deadState = new State();
                    dfaStateMap.set(deadKey, deadState);
                    stateSets.set(deadKey, new Set());
                    dfaTransitions.set(deadState, {});
                    for (let s of alphabet) {
                        dfaTransitions.get(deadState)[s] = deadState;
                    }
                }
                targetDfa = dfaStateMap.get(deadKey);
            } else {
                targetDfa = dfaStateMap.get(newKey);
            }

            dfaTransitions.get(currDfa)[sym] = targetDfa;
        }
    }

    return new DFA(startDfa, acceptStates, dfaTransitions);
}

// Simulate NFA
function simulateNFA(nfa, inputString) {
    function epsilonClosure(states) {
        const stack = [...states];
        const closure = new Set(states);
        const visited = new Set();
        while (stack.length) {
            const state = stack.pop();
            if (visited.has(state)) continue;
            visited.add(state);
            for (let nextState of state.epsilon) {
                if (!closure.has(nextState)) {
                    closure.add(nextState);
                    stack.push(nextState);
                }
            }
        }
        return closure;
    }

    let currentStates = epsilonClosure(new Set([nfa.start]));
    for (let symbol of inputString) {
        let nextStates = new Set();
        for (let state of currentStates) {
            if (state.transitions[symbol]) {
                for (let t of state.transitions[symbol]) {
                    nextStates.add(t);
                }
            }
        }
        currentStates = epsilonClosure(nextStates);
    }
    return currentStates.has(nfa.accept);
}

// Simulate DFA
function simulateDFA(dfa, input) {
    let curr = dfa.start;
    for (const sym of input) {
        const transMap = dfa.transitions.get(curr);
        if (!transMap || !transMap[sym]) return false;
        curr = transMap[sym];
    }
    return dfa.acceptStates.has(curr);
}

// Compute Automaton Metrics
function getAutomatonMetrics(automaton) {
    const visited = new Set();
    let transitionCount = 0;
    let epsilonCount = 0;
    let acceptingCount = automaton instanceof NFA ? 1 : automaton.acceptStates.size;

    function visit(state) {
        if (visited.has(state)) return;
        visited.add(state);
        for (let sym in state.transitions) {
            if (state.transitions[sym] instanceof State) {
                transitionCount++;
            } else if (state.transitions[sym] instanceof Set) {
                transitionCount += state.transitions[sym].size;
            }
        }
        epsilonCount += (state.epsilon || []).size;
        for (let sym in state.transitions) {
            if (state.transitions[sym] instanceof State) {
                visit(state.transitions[sym]);
            } else if (state.transitions[sym] instanceof Set) {
                for (let nextState of state.transitions[sym]) {
                    visit(nextState);
                }
            }
        }
        for (let nextState of state.epsilon || []) {
            visit(nextState);
        }
    }

    visit(automaton.start);
    return {
        states: visited.size,
        transitions: transitionCount,
        epsilonTransitions: automaton instanceof NFA ? epsilonCount : 0,
        acceptingStates: acceptingCount
    };
}

// Compute State Distribution
function getStateDistribution(automaton) {
    const visited = new Set();
    let startCount = 1;
    let acceptingCount = automaton instanceof NFA ? 1 : automaton.acceptStates.size;
    let epsilonStateCount = 0;

    function visit(state) {
        if (visited.has(state)) return;
        visited.add(state);
        if ((state.epsilon || []).size > 0) epsilonStateCount++;
        for (let sym in state.transitions) {
            if (state.transitions[sym] instanceof State) {
                visit(state.transitions[sym]);
            } else if (state.transitions[sym] instanceof Set) {
                for (let nextState of state.transitions[sym]) {
                    visit(nextState);
                }
            }
        }
        for (let nextState of state.epsilon || []) {
            visit(nextState);
        }
    }

    visit(automaton.start);
    const totalStates = visited.size;
    const nonAcceptingNonEpsilon = totalStates - acceptingCount - epsilonStateCount;
    return {
        start: startCount,
        accepting: acceptingCount,
        epsilon: automaton instanceof NFA ? epsilonStateCount : 0,
        other: Math.max(0, nonAcceptingNonEpsilon)
    };
}

// Compute Symbol Frequency
function getSymbolFrequency(automaton) {
    const symbolCounts = new Map();
    const visited = new Set();

    function visit(state) {
        if (visited.has(state)) return;
        visited.add(state);
        for (let sym in state.transitions) {
            if (state.transitions[sym] instanceof State) {
                symbolCounts.set(sym, (symbolCounts.get(sym) || 0) + 1);
                visit(state.transitions[sym]);
            } else if (state.transitions[sym] instanceof Set) {
                symbolCounts.set(sym, (symbolCounts.get(sym) || 0) + state.transitions[sym].size);
                for (let nextState of state.transitions[sym]) {
                    visit(nextState);
                }
            }
        }
        for (let nextState of state.epsilon || []) {
            visit(nextState);
        }
    }

    visit(automaton.start);
    return Array.from(symbolCounts.entries()).sort();
}

// Display Transitions
function getTransitions(automaton) {
    const visited = new Set();
    const ids = new Map();
    let counter = 0;
    let result = [];

    function visit(state) {
        if (!visited.has(state)) {
            visited.add(state);
            ids.set(state, `S${counter++}`);
            for (let sym in state.transitions) {
                if (state.transitions[sym] instanceof State) {
                    visit(state.transitions[sym]);
                } else if (state.transitions[sym] instanceof Set) {
                    for (let t of state.transitions[sym]) {
                        visit(t);
                    }
                }
            }
            for (let t of state.epsilon) {
                visit(t);
            }
        }
    }

    visit(automaton.start);

    for (let state of visited) {
        const sid = ids.get(state);
        const transitions = automaton instanceof DFA ? automaton.transitions.get(state) || {} : state.transitions;
        for (let sym in transitions) {
            if (transitions[sym] instanceof State) {
                result.push(`${sid} -- ${sym} --> ${ids.get(transitions[sym])}`);
            } else if (transitions[sym] instanceof Set) {
                for (let t of transitions[sym]) {
                    result.push(`${sid} -- ${sym} --> ${ids.get(t)}`);
                }
            }
        }
        for (let t of state.epsilon) {
            result.push(`${sid} -- ε --> ${ids.get(t)}`);
        }
    }
    result.push(`\nStart: ${ids.get(automaton.start)}`);
    if (automaton instanceof NFA) {
        result.push(`Accept: ${ids.get(automaton.accept)}`);
    } else {
        result.push(`Accept: ${[...automaton.acceptStates].map(s => ids.get(s)).join(', ')}`);
    }
    return [result.join('\n'), ids];
}

// Generate Graph (using Viz.js)
function drawAutomaton(automaton) {
    const dot = ["digraph G {"];
    dot.push('rankdir=LR;');
    const visited = new Set();
    const ids = new Map();
    let count = 0;

    function getId(state) {
        if (!ids.has(state)) {
            ids.set(state, `S${count++}`);
        }
        return ids.get(state);
    }

    function dfs(state) {
        const sid = getId(state);
        if (visited.has(state)) return;
        visited.add(state);
        const isAccept = automaton instanceof NFA ? state === automaton.accept : automaton.acceptStates.has(state);
        dot.push(`${sid} [shape=${isAccept ? "doublecircle" : "circle"}];`);
        const transitions = automaton instanceof DFA ? automaton.transitions.get(state) || {} : state.transitions;
        for (let sym in transitions) {
            if (transitions[sym] instanceof State) {
                const tid = getId(transitions[sym]);
                dot.push(`${sid} -> ${tid} [label="${sym}"];`);
                dfs(transitions[sym]);
            } else if (transitions[sym] instanceof Set) {
                for (let t of transitions[sym]) {
                    const tid = getId(t);
                    dot.push(`${sid} -> ${tid} [label="${sym}"];`);
                    dfs(t);
                }
            }
        }
        for (let t of state.epsilon) {
            const tid = getId(t);
            dot.push(`${sid} -> ${tid} [label="ε"];`);
            dfs(t);
        }
    }

    dfs(automaton.start);
    dot.push("}");
    const viz = new Viz();
    return viz.renderSVGElement(dot.join('\n'));
}

// Save Automaton
function saveAutomaton(postfix, transitions, diagramSvg, type) {
    const data = {
        postfix: postfix,
        transitions: transitions,
        diagram: diagramSvg.outerHTML,
        type: type
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type.toLowerCase()}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Load Automaton
function loadAutomaton(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = JSON.parse(event.target.result);
            callback(data);
        };
        reader.readAsText(file);
    };
    input.click();
}


const App = () => {
    const [regex, setRegex] = useState('');
    const [postfix, setPostfix] = useState('');
    const [transitions, setTransitions] = useState('');
    const [diagramSvg, setDiagramSvg] = useState(null);
    const [automaton, setAutomaton] = useState(null);
    const [automatonType, setAutomatonType] = useState('DFA');
    const [simulateString, setSimulateString] = useState('');
    const [simulateResult, setSimulateResult] = useState('');
    const [testStrings, setTestStrings] = useState('');
    const [testResults, setTestResults] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const chartRef = useRef(null);
    const chartInstance = useRef(null);
    const pieChartRef = useRef(null);
    const pieChartInstance = useRef(null);
    const histChartRef = useRef(null);
    const histChartInstance = useRef(null);
    

    const processRegex = () => {
        const [isValid, errorMsg] = validateRegex(regex);
        if (!isValid) {
            alert(errorMsg);
            return;
        }
        setShowModal(true);
    };

    const handleAutomatonSelection = async (type) => {
        setShowModal(false);
        setAutomatonType(type);
        try {
            const regexConcat = insertConcat(regex);
            const postfixExpr = infixToPostfix(regexConcat);
            let automatonResult = regexToNFA(postfixExpr);
            if (type === 'DFA') {
                automatonResult = nfaToDFA(automatonResult);
            }
            const [trans, _] = getTransitions(automatonResult);
            const svg = await drawAutomaton(automatonResult);

            setPostfix(postfixExpr);
            setTransitions(trans);
            setDiagramSvg(svg);
            setAutomaton(automatonResult);
            setSimulateResult('');
            setTestResults([]);

            // Update Bar Chart
            const metrics = getAutomatonMetrics(automatonResult);
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            chartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['States', 'Transitions', 'Epsilon Transitions', 'Accepting States'],
                    datasets: [{
                        label: type,
                        data: [metrics.states, metrics.transitions, metrics.epsilonTransitions, metrics.acceptingStates],
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.5)',
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(75, 192, 192, 0.5)',
                            'rgba(153, 102, 255, 0.5)'
                        ],
                        borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Count' } },
                        x: { title: { display: true, text: 'Metric' } }
                    },
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: `${type} Metrics` }
                    }
                }
            });

            // Update Pie Chart
            const distribution = getStateDistribution(automatonResult);
            if (pieChartInstance.current) pieChartInstance.current.destroy();
            const pieCtx = pieChartRef.current.getContext('2d');
            pieChartInstance.current = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: ['Start State', 'Accepting States', 'Epsilon States', 'Other States'],
                    datasets: [{
                        data: [distribution.start, distribution.accepting, distribution.epsilon, distribution.other],
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.5)',
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(75, 192, 192, 0.5)',
                            'rgba(153, 102, 255, 0.5)'
                        ],
                        borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: true, position: 'top' },
                        title: { display: true, text: 'State Distribution' }
                    }
                }
            });

            // Update Histogram
            const symbolFreq = getSymbolFrequency(automatonResult);
            if (histChartInstance.current) histChartInstance.current.destroy();
            const histCtx = histChartRef.current.getContext('2d');
            histChartInstance.current = new Chart(histCtx, {
                type: 'bar',
                data: {
                    labels: symbolFreq.map(([s]) => s),
                    datasets: [{
                        label: 'Transition Count',
                        data: symbolFreq.map(([, count]) => count),
                        backgroundColor: 'rgba(255, 159, 64, 0.5)',
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Count' } },
                        x: { title: { display: true, text: 'Symbol' } }
                    },
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: 'Transition Symbol Frequency' }
                    }
                }
            });
        } catch (e) {
            alert(`Invalid regex: ${e}`);
        }
    };

    const simulate = () => {
        if (!automaton) {
            alert(`No ${automatonType} available. Process a regex first.`);
            return;
        }
        if (!simulateString) {
            alert("Please enter a test string.");
            return;
        }
        const result = automatonType === 'NFA' ? simulateNFA(automaton, simulateString) : simulateDFA(automaton, simulateString);
        setSimulateResult(`String '${simulateString}' is ${result ? 'Accepted' : 'Rejected'} by the ${automatonType}.`);
    };

    const runTestSuite = () => {
        if (!automaton) {
            alert(`No ${automatonType} available. Process a regex first.`);
            return;
        }
        const strings = testStrings.split('\n').map(s => s.trim()).filter(s => s);
        if (!strings.length) {
            alert("Please enter at least one test string.");
            return;
        }
        const results = strings.map(str => ({
            string: str,
            result: (automatonType === 'NFA' ? simulateNFA : simulateDFA)(automaton, str) ? 'Accepted' : 'Rejected'
        }));
        setTestResults(results);
    };

    const save = () => {
        if (!automaton || !diagramSvg) {
            alert(`No ${automatonType} to save.`);
            return;
        }
        saveAutomaton(postfix, transitions, diagramSvg, automatonType);
    };

    const load = () => {
        loadAutomaton((data) => {
            setPostfix(data.postfix);
            setTransitions(data.transitions);
            const svgElement = document.createElement('div');
            svgElement.innerHTML = data.diagram;
            setDiagramSvg(svgElement.firstChild);
            setAutomatonType(data.type || 'DFA');
            setSimulateResult('');
            setTestResults([]);

            // Regenerate automaton from saved postfix
            let automatonResult = regexToNFA(data.postfix);
            if (data.type === 'DFA') {
                automatonResult = nfaToDFA(automatonResult);
            }
            setAutomaton(automatonResult);

            // Update Charts
            const metrics = getAutomatonMetrics(automatonResult);
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            chartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['States', 'Transitions', 'Epsilon Transitions', 'Accepting States'],
                    datasets: [{
                        label: data.type || 'DFA',
                        data: [metrics.states, metrics.transitions, metrics.epsilonTransitions, metrics.acceptingStates],
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.5)',
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(75, 192, 192, 0.5)',
                            'rgba(153, 102, 255, 0.5)'
                        ],
                        borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Count' } },
                        x: { title: { display: true, text: 'Metric' } }
                    },
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: `${data.type || 'DFA'} Metrics` }
                    }
                }
            });

            const distribution = getStateDistribution(automatonResult);
            if (pieChartInstance.current) pieChartInstance.current.destroy();
            const pieCtx = pieChartRef.current.getContext('2d');
            pieChartInstance.current = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: ['Start State', 'Accepting States', 'Epsilon States', 'Other States'],
                    datasets: [{
                        data: [distribution.start, distribution.accepting, distribution.epsilon, distribution.other],
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.5)',
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(75, 192, 192, 0.5)',
                            'rgba(153, 102, 255, 0.5)'
                        ],
                        borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: true, position: 'top' },
                        title: { display: true, text: 'State Distribution' }
                    }
                }
            });

            const symbolFreq = getSymbolFrequency(automatonResult);
            if (histChartInstance.current) histChartInstance.current.destroy();
            const histCtx = histChartRef.current.getContext('2d');
            histChartInstance.current = new Chart(histCtx, {
                type: 'bar',
                data: {
                    labels: symbolFreq.map(([s]) => s),
                    datasets: [{
                        label: 'Transition Count',
                        data: symbolFreq.map(([, count]) => count),
                        backgroundColor: 'rgba(255, 159, 64, 0.5)',
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Count' } },
                        x: { title: { display: true, text: 'Symbol' } }
                    },
                    plugins: {
                        legend: { display: true },
                        title: { display: true, text: 'Transition Symbol Frequency' }
                    }
                }
            });
        });
    };

    return (
        <div className="container mx-auto p-4 bg-white rounded shadow">
            <h1 className="text-2xl font-bold mb-4">Enhanced Regex to NFA/DFA Converter</h1>

            <div className="mb-4">
                <label className="block mb-1">Enter Regex:</label>
                <input
                    type="text"
                    value={regex}
                    onChange={(e) => setRegex(e.target.value)}
                    className="text-lg border p-3 rounded-lg w-full"
                    placeholder="e.g., (a+)b"
                />
            </div>

            <div className="mb-4 flex space-x-2">
                <button onClick={processRegex} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Convert</button>
                <button onClick={save} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save {automatonType || 'Automaton'}</button>
                <button onClick={load} className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">Load {automatonType || 'Automaton'}</button>
            </div>

            {showModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h3 className="text-lg font-semibold mb-4">Select Conversion Type</h3>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => handleAutomatonSelection('NFA')}
                                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                            >
                                Convert to NFA
                            </button>
                            <button
                                onClick={() => handleAutomatonSelection('DFA')}
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                                Convert to DFA
                            </button>
                        </div>
                        <button
                            onClick={() => setShowModal(false)}
                            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {postfix && (
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Postfix Expression:</h2>
                    <pre className="bg-gray-100 p-4 rounded text-sm">{postfix}</pre>
                </div>
            )}

            {transitions && (
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Transitions:</h2>
                    <pre className="bg-gray-100 p-4 rounded text-sm">{transitions}</pre>
                </div>
            )}

            {diagramSvg && (
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">{automatonType} Diagram:</h2>
                    <div id={`${automatonType.toLowerCase()}-diagram`} dangerouslySetInnerHTML={{ __html: diagramSvg.outerHTML }}></div>
                </div>
            )}

            <div className="mb-4">
                <h2 className="text-lg font-semibold mb-2">Automaton Metrics:</h2>
                <canvas id="graph-container" ref={chartRef}></canvas>
                <h2 className="text-lg font-semibold mt-4 mb-2">State Distribution:</h2>
                <canvas id="pie-chart-container" ref={pieChartRef}></canvas>
                <h2 className="text-lg font-semibold mt-4 mb-2">Transition Symbol Frequency:</h2>
                <canvas id="hist-chart-container" ref={histChartRef}></canvas>
            </div>

            <div className="mb-4">
                <label className="block mb-1">Test String for Simulation:</label>
                <input
                    type="text"
                    value={simulateString}
                    onChange={(e) => setSimulateString(e.target.value)}
                    className="text-lg border p-3 rounded-lg w-full mb-2"
                    placeholder="e.g., aab"
                />
                <button onClick={simulate} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Simulate</button>
                {simulateResult && <p className="mt-2 text-sm">{simulateResult}</p>}
            </div>

            <div className="mb-4">
                <label className="block mb-1">Test Suite (one string per line):</label>
                <textarea
                    value={testStrings}
                    onChange={(e) => setTestStrings(e.target.value)}
                    className="text-lg border p-3 rounded-lg w-full"
                    rows="5"
                    placeholder="e.g., ab\naab\nb"
                ></textarea>
                <button onClick={runTestSuite} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Run Tests</button>
            </div>

            {testResults.length > 0 && (
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Test Results:</h2>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="text-sm border p-2">Test String</th>
                                <th className="text-sm border p-2">Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {testResults.map((result, index) => (
                                <tr key={index}>
                                    <td className="border p-2 text-sm">{result.string}</td>
                                    <td className="border p-2 text-sm">{result.result}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));