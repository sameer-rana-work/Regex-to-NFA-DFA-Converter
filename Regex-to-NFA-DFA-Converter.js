const { useState, useEffect, useRef } = React;

const App = () => {
    const [regex, setRegex] = useState('');
    const [postfix, setPostfix] = useState('');
    const [transitions, setTransitions] = useState('');
    const [diagramSvg, setDiagramSvg] = useState(null);
    const [automaton, setAutomaton] = useState(null);
    const [automatonType, setAutomatonType] = useState('');
    const [simulateString, setSimulateString] = useState('');
    const [simulateResult, setSimulateResult] = useState('');
    const [testStrings, setTestStrings] = useState('');
    const [testResults, setTestResults] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

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

            // Update Graph
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            const stateCount = getStateCount(automatonResult);
            chartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [type],
                    datasets: [{
                        label: 'Number of States',
                        data: [stateCount],
                        backgroundColor: type === 'NFA' ? 'rgba(54, 162, 235, 0.5)' : 'rgba(255, 99, 132, 0.5)',
                        borderColor: type === 'NFA' ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Number of States' } },
                        x: { title: { display: true, text: 'Automaton Type' } }
                    },
                    plugins: { legend: { display: true } }
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
        setSimulateResult(`String '${simulateString}' is ${result ? 'accepted' : 'rejected'} by the ${automatonType}.`);
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
            setRegex('');
            setSimulateResult('');
            setTestResults([]);
            setAutomatonType(data.type || 'NFA');
            const regexConcat = insertConcat(regex || data.postfix.replace(/[.+*?|]/g, ''));
            const postfixExpr = infixToPostfix(regexConcat);
            let automatonResult = regexToNFA(postfixExpr);
            if (data.type === 'DFA') {
                automatonResult = nfaToDFA(automatonResult);
            }
            setAutomaton(automatonResult);

            // Update Graph
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            const stateCount = getStateCount(automatonResult);
            chartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [data.type || 'NFA'],
                    datasets: [{
                        label: 'Number of States',
                        data: [stateCount],
                        backgroundColor: (data.type || 'NFA') === 'NFA' ? 'rgba(54, 162, 235, 0.5)' : 'rgba(255, 99, 132, 0.5)',
                        borderColor: (data.type || 'NFA') === 'NFA' ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Number of States' } },
                        x: { title: { display: true, text: 'Automaton Type' } }
                    },
                    plugins: { legend: { display: true } }
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
                    className="border p-2 rounded"
                    placeholder="e.g., (a+)b"
                />
            </div>

            <div className="mb-4 flex space-x-2">
                <button onClick={processRegex} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Convert</button>
                <button onClick={save} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Save {automatonType || 'Automaton'}</button>
                <button onClick={load} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">Load {automatonType || 'Automaton'}</button>
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
                            className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {postfix && (
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Postfix:</h2>
                    <pre className="bg-gray-100 p-2 rounded">{postfix}</pre>
                </div>
            )}

            {transitions && (
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Transitions:</h2>
                    <pre className="bg-gray-100 p-2 rounded">{transitions}</pre>
                </div>
            )}

            {diagramSvg && (
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">{automatonType} Diagram:</h2>
                    <div id={`${automatonType.toLowerCase()}-diagram`} dangerouslySetInnerHTML={{ __html: diagramSvg.outerHTML }}></div>
                </div>
            )}

            <div className="mb-4">
                <h2 className="text-lg font-semibold">Graph Representation:</h2>
                <canvas id="graph-container" ref={chartRef}></canvas>
            </div>

            <div className="mb-4">
                <label className="block mb-1">Test String for Simulation:</label>
                <input
                    type="text"
                    value={simulateString}
                    onChange={(e) => setSimulateString(e.target.value)}
                    className="border p-2 rounded mb-2"
                    placeholder="e.g., ab"
                />
                <button onClick={simulate} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Simulate</button>
                {simulateResult && <p className="mt-2">{simulateResult}</p>}
            </div>

            <div className="mb-4">
                <label className="block mb-1">Test Suite (one string per line):</label>
                <textarea
                    value={testStrings}
                    onChange={(e) => setTestStrings(e.target.value)}
                    className="border p-2 rounded"
                    rows="5"
                    placeholder="e.g., ab\naab\nb"
                ></textarea>
                <button onClick={runTestSuite} className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Run Tests</button>
            </div>

            {testResults.length > 0 && (
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Test Results:</h2>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="text-sm border p-2">Test String</th>
                                <th className="border p-2">Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {testResults.map((result, index) => (
                                <tr key={index}>
                                    <td className="border p-2">{result.string}</td>
                                    <td className="border p-2">{result.result}</td>
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