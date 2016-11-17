/* global URL, fetch, Viz */

const HG = 'https://hg.mozilla.org/try/';
let logs = new Map();

function loadUser(user, startdate) {
    let pushesURL = new URL('json-pushes', HG);
    pushesURL.searchParams.set('user', user);
    pushesURL.searchParams.set('startdate', startdate);
    fetch(pushesURL)
        .then(response => response.json())
        .then(findAncestor);
}

function findAncestor(pushes) {
    let logURL = new URL('json-log', HG);
    let tips = Object.values(pushes)
        .map(push => push.changesets[push.changesets.length-1]);
    logURL.searchParams.set('rev', `ancestor(${tips.join(',')})`);
    fetch(logURL)
        .then(response => response.json())
        .then(function(ancestorLog) {
            let cs = ancestorLog.entries[0];
            logs.set(cs.node, cs);
            let baserev = cs.node;
            let requests =
                tips.map(function(tip) {
                logURL.searchParams.set('rev', `${baserev}::${tip}`);
                return fetch(logURL)
                    .then(response => response.json())
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
        if (/try:/.test(label)) label = cs.node.slice(0, 12);
        label = label.replace(/"/g,'\\"');
        let desc = cs.desc.replace(/"/g,'\\"');
        nodes.push(`"${cs.node}" [ tooltip = "${desc}" label = "${label}" ] ;`);
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
    document.getElementById('output').innerHTML = viz;
}

let params = new URL(document.location).searchParams;
loadUser(params.get('user'), `${params.get('days')} days before now`);
