const margin = {
    left: 0, right: 0, top: 0, bottom: 0
}
const svgWidth = 700;
const svgHeight = 800;
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const svg = d3
.select('body')
.append('svg')
.attr('width', svgWidth)
.attr('height', svgHeight)

const contentContainer = svg.append('g')
.attr('class', 'container')
.attr('transform', `translate(${margin.left}, ${margin.top})`)
.style('user-select', 'none')
.style('pointer-events', 'all')

svg
.call(d3.zoom().on('zoom', () => {
    contentContainer.attr('transform', d3.event.transform)
}))

const simulation = d3.forceSimulation()
.force('link', d3.forceLink()
    .id((d) => d.label)
    // this d is per link {source, target, etc..}
    .distance((d) => d.distance)
    // for strength, recommended max is 2, > 3 will cause crash
    .strength((d) => 1)
)
.force('charge', d3.forceManyBody().strength(0))
.force('center', d3.forceCenter(width / 2, height / 2))
.force('collision', d3.forceCollide((d) => d.radius).strength(.8))

const tooltip = d3.select('#tooltip');
const tooltipClusterLabel = d3.select('#tooltip #name');


const clusters = {};
let clusterCount = 0;
const linkMap = {};

d3.csv('./raw-data.csv', (d) => {
    // painting data
    const data = {
        cluster: d['Artist Name'],
        label: d['Filename'],
        colors: [d['Color 1'], d['Color 2'], d['Color 3'], d['Color 4'], d['Color 5'], d['Color 6'], d['Color 7'], d['Color 8']],
        subcategory: d.Subcategory,
        // links is an array of labels
        links: [d['Artist Name']],
        radius: 10,//+d.Count * 2,
        repulsion: 3//+d.Count,
    };

    data.colors = data.colors.map((string) => {
        if (!string) {
            return;
        }
        // remove #
        if (string.charAt(0) === '#') {
            string = string.substr(1);
        }
        const r = parseInt(string.substr(0, 2), 16);
        const g = parseInt(string.substr(2, 2), 16);
        const b = parseInt(string.substr(4, 2), 16);
        return {r, g, b, hex: string};
    })

    for (let i = 0; i < data.colors.length; i++) {
        if (!data.colors[i]) {
            data.colors.splice(i, 1);
            i -= 1;
        }
    }

    if (!clusters[data.cluster]) {
        clusters[data.cluster] = clusterCount;
        clusterCount += 1;
    }

    if (!linkMap[data.label]) {
        linkMap[data.label] = {};
    }

    if (!linkMap[data.cluster]) {
        linkMap[data.cluster] = {};
    }
 
    return data; 
}).then((data) => {

    // create a center node for each artist/cluster
    Object.keys(clusters).forEach((key) => {
        const clusterData = {
            cluster: key,
            label: key,
            colors: [],
            // subcategory: d.Subcategory,
            // links is an array of labels
            links: [],
            radius: 20,//+d.Count * 2,
            repulsion: 3//+d.Count,
        };
        data.push(clusterData);
    })

    const colorScheme = d3.schemeSet1;

    const linkContainer = contentContainer.append('g')
    .attr('class', 'link-container')

    const nodeContainer = contentContainer.append('g')
    .attr('class', 'node-container')

    

    const links = [];

    const dataMap = {}

    nodeContainer.selectAll('circle')
    .data(data).enter()
    .append('circle')
    .attr('class', 'node')
    .attr('id', (d) => d.label)
    .attr('r', (d) => d.radius)
    // .attr('fill', (d) => colorScheme[clusters[d.cluster]])
    .attr('fill', (d) => {
        return d.colors[0] ? `#${d.colors[0].hex}` : colorScheme[clusters[d.cluster]];
    })
    .each((d, i, nodes) => {
        d.node = nodes[i];
        dataMap[d.label] = d;
    })
    .each((d) => {
        // add links to links
        d.links.forEach((label) => {
            // check if links already has this combination, key or value
            if (linkMap[label][d.label] || linkMap[d.label][label]) {
                return;
            }
            linkMap[d.label][label] = true;
            links.push({
                source: d.label,
                target: label,
                distance: d.repulsion * dataMap[label].repulsion,
                repulsion: (d.repulsion * dataMap[label].repulsion) / 81,
                // strength: d.cluster === dataMap[label].cluster ? 1 : .3
            })
        });
    })
    .call(d3.drag()
        .on('start', (d) => {
            // prevent simulation restart on drag if simulation is disabled
            if (!d3.event.active) {
                simulation.alphaTarget(.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
        })
        .on('drag', (d) => {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
            d.node.setAttribute('cx', d3.event.x);
            d.node.setAttribute('cy', d3.event.y);
            d.x = d3.event.x;
            d.y = d3.event.y;
            d.lines.forEach((line) => {
                // set the line to match the unsimulated circle positions
                // use the linkData set when the links were created
                line.setAttribute('x1', line.linkData.sourceNode.getAttribute('cx'))
                line.setAttribute('y1', line.linkData.sourceNode.getAttribute('cy'))
                line.setAttribute('x2', line.linkData.targetNode.getAttribute('cx'))
                line.setAttribute('y2', line.linkData.targetNode.getAttribute('cy'))
            })
            // hide tooltip if dragging
            tooltip.style('display', 'none')
        })
        .on('end', (d) => {
            if (!d3.event.active) {
                simulation.alphaTarget(0);
            }
            d.fx = null;
            d.fy = null;
        })
    )

    const nodeCircles = nodeContainer.selectAll('circle')
    .on('mouseover', (d) => {
        d.colors?.forEach((color, i) => {
            /* Insert color */
            const rect = d3.select("#tooltip #pal") // selects div with id: "tooltip" and child id "pal"
            .append("rect") // appends rectangle 
            .attr("width", "25px") // sets width 
            .attr("height", "25") // sets height 
            .attr("fill", `#${color.hex}`) // sets fill to first color from data
            .attr("x", i * 25) // sets x position 
            .attr("y", "10"); // sets y position 
            color.rect = rect;
        })
    })
    .on('mousemove', (d) => {
        // const node = nodes[i];
        const e = d3.event;

        // const d = dataMap[node.id];
        tooltipClusterLabel.text(d.label)
        // tooltipSubcategorLabel.textContent = d.subcategory;
        tooltip
        .style('display', 'block')
        .style('left', `${e.clientX + 10}px`)
        .style('top', `${e.clientY + 10}px`)

        d.lines?.forEach((line) => {
            line.classList.toggle('highlight', true);
        })
    })
    .on('mouseout', (d) => {
        // const node = nodes[i];
        // const d = dataMap[node.id];
        tooltip.style('display', 'none')
        d.lines.forEach((line) => {
            line.classList.toggle('highlight', false);
        })
        d.colors?.forEach((color) => {
            color.rect?.remove();
        })
    })  

    linkContainer.selectAll('line')
    .data(links).enter()
    .append('line')
    .attr('class', 'link')
    .each((d, i, nodes) => {
        // add link line reference to each data point
        Array.from([d.source, d.target]).forEach((label) => {
            if (!dataMap[label].lines) {
                dataMap[label].lines = [];
            }
            dataMap[label].lines.push(nodes[i]);
        })
        // store the source and target nodes in the link
        d.sourceNode = dataMap[d.source].node;
        d.targetNode = dataMap[d.target].node;
        // store the link data in the line itself
        nodes[i].linkData = d;
    })

    // create a selection of all lines
    const linkLines = linkContainer.selectAll('line');

    // for every simulation tick, when it is running
    // use the original data as the nodes
    simulation.nodes(data)
    .on('tick', () => {

        // update link lines to connect the source and target
        linkLines
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)

        // update node circle positions
        nodeCircles
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
    })

    // set the links for the simulation
    simulation.force('link')
    .links(links);
})