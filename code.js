/* global URL, fetch, Viz */

const HG = 'https://hg.mozilla.org/try/';
let logs = new Map();

function addProgress(closure) {
    document.getElementById('output').textContent += '.';
    return closure;
}

function loadPushes(params) {
    if (!params.has('user') || !(params.has('startdate')||params.has('days'))) {
        return;
    }
    let pushesURL = new URL('json-pushes', HG);
    pushesURL.searchParams.set('user', params.get('user'));
    if (params.has('startdate')) {
        pushesURL.searchParams.set('startdate', params.get('startdate'));
    }
    else {
        pushesURL.searchParams.set('startdate', `${params.get('days')} days before now`);
    }
    if (params.has('enddate')) {
        pushesURL.searchParams.set('enddate', params.get('enddate'));
    }
    fetch(pushesURL)
        .then(response => response.json())
        .then(addProgress)
        .then(findAncestor);
}

function findAncestor(pushes) {
    let logURL = new URL('json-log', HG);
    let tips = Object.values(pushes)
        .map(push => push.changesets[push.changesets.length-1]);
    logURL.searchParams.set('rev', `ancestor(${tips.join(',')})`);
    fetch(logURL)
        .then(response => response.json())
        .then(addProgress)
        .then(function(ancestorLog) {
            let cs = ancestorLog.entries[0];
            logs.set(cs.node, cs);
            let baserev = cs.node;
            let requests =
                tips.map(function(tip) {
                logURL.searchParams.set('rev', `${baserev}::${tip}`);
                return fetch(logURL)
                    .then(response => response.json())
                    .then(addProgress)
                    .then(function(log) {
                        log.entries.forEach(cs => logs.set(cs.node, cs));
                    });
            });
            return Promise.all(requests);
        })
        .then(renderLogs);
}

function renderLogs() {
    let nodes = [], arcs = [];
    for (let cs of logs.values()) {
        let label = cs.desc.split("\n", 1)[0];
        let URL = `URL = "https://hg.mozilla.org/try/rev/${cs.node}"`;
        if (/try:/.test(label)) {
            label = cs.node.slice(0, 12);
            URL = '';
        }
        label = label.replace(/"/g,'\\"');
        let desc = cs.desc.replace(/"/g,'\\"');
        nodes.push(`"${cs.node}" [ ${URL} tooltip = "${desc}\n\n${cs.node}" label = "${label}" ] ;`);
        cs.parents
            .filter(parent => logs.has(parent))
            .forEach(function (parent) {
                arcs.push(`"${parent}" -> "${cs.node}" ;`);
            });
    }
    let viz = Viz(`digraph "" {
  node [shape=box];
  ${nodes.join("\n")}
  ${arcs.join("\n")}
}
`);
    let output = document.getElementById('output');
    output.innerHTML = viz;
    let try_nodes = Array.from(output.querySelectorAll('text'))
        .filter(text_node => /^[0-9a-g]{12}$/.test(text_node.textContent));
    try_nodes.forEach(function(try_node) {
        try_node.parentNode.onclick = function() {
            try_node.classList.toggle('selected');
            updateTalosCompare();
        };
    });
}

function updateTalosCompare() {
    let talos_compare = new URL('https://pike.github.io/talos-compare/');
    Array.from(
            document.querySelectorAll('.selected'),
            tn => tn.textContent)
        .forEach(rev => talos_compare.searchParams.append('revision',rev));
    let talos_link = document.getElementById('talos-link');
    talos_link.href = talos_compare;
    talos_link.disabled = false;
}

let params = new URL(document.location).searchParams;
loadPushes(params);
