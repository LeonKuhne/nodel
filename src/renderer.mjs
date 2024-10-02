import { findTemplates } from './util.mjs'
import { toRegPos } from './util.mjs'
import LinkerLine from 'linkerline'

export class NodelRender {
  constructor() {
    this.recenter()
    this.resetScale()
    this.templates = findTemplates()

    // hide the templates
    this.hideTemplates = false
    this.toggleTemplates()
    this.connectionBinding = {}
    this.connectionColorCallback = () => '#ad00d9'
    this.connectionLabelCallback = () => ''
    this.helpers = {
      'connection-color': () => '#ad00d9',
      'connection-label': () => '',
    }
    this.lines = []
  }
  toggleTemplates() {
    this.hideTemplates = !this.hideTemplates

    // hide html elements
    for (const template of this.templates) {
      let elem = document.getElementById(template)
      elem.hidden = this.hideTemplates
    }
  }
  // internal
  clear() {
    const nodel = document.getElementById('nodel')

    // reset the lines
    this.disconnectAll()

    // reset the nodes
    for (let idx = nodel.children.length-1; idx >= 0; idx--) {
      const child = nodel.children[idx]
      if (!this.templates.includes(child.id)) {
        nodel.removeChild(child)
      }
    }
  }
  on(type, callback) {
    this.helpers[type] = callback
  }
  draw(nodes) {
    const nodel = document.getElementById('nodel')

    // keep templates and remove all other elements
    this.clear()

    // filter out collapsed nodes
    const visibleNodes = Object.values(nodes).filter(node => node.isVisible(nodes))
    console.debug('Visible nodes', visibleNodes)

    // 
    // Draw Nodes
    
    for (const node of visibleNodes) {
      // add the element
      const nodeElem = document.getElementById(node.template).cloneNode(true)
      nodel.appendChild(nodeElem)

      // configure element
      nodeElem.id = node.id
      nodeElem.hidden = false
      if (node.isGroup(true)) {
        nodeElem.classList.add('group')
      }

      // supply variables
      // NOTE: vulnerable to XSS
      let varProps = node.group.collapsed ? node.group : node.data
      for (let [attr, value] of Object.entries(varProps)) {
        nodeElem.innerHTML = nodeElem.innerHTML.replaceAll(`{${attr}}`, value)
      }

      // calculate coordinates
      const [elemX, elemY] = toRegPos(node)

      // set the position
      nodeElem.style.position = 'absolute'
      nodeElem.style.left = `${elemX - nodeElem.offsetWidth/2}px`
      nodeElem.style.top = `${elemY - nodeElem.offsetHeight/2}px`
    }

    //
    // Link Children
    
    for (const node of visibleNodes) {
      // format the node as a leaf
      const leaves = node.group.collapsed ? node.group.ends : [node.id]

      // link node with the children of its leaves
      for (const leafId of leaves) {
        const leaf = nodes[leafId]
          
        for (const [connectionType, children] of Object.entries(leaf.children)) {
          for (const childId of children) {
            const child = nodes[childId]
            let start = node
            let end = null
            let dashed = false

            // filter out non visible nodes
            if (visibleNodes.includes(child)) {
              end = child
            } else {
              // draw a dotted connection to the nodes parent group
              const groups = child.getInvolvedGroupNodes(nodes)
              const firstCollapsedGroup = groups.reverse().find(node => node.group.collapsed)
              end = firstCollapsedGroup
              dashed = true
            }

            // draw the connection
            const connection = this.drawConnection(start, end, connectionType, dashed)

            // add any existing callbacks to the connection element
            const binding = this.connectionBinding
            if (binding.eventType && binding.callback) {
              const arrowElem = Array.from(document
                .querySelector(`path#linker-line-${connection._id}-line-path`)
                .closest('svg.leader-line')
                .querySelectorAll('text'))
                .find(elem => elem.textContent === connection.middleLabel)
              arrowElem.classList.add('connection')
              arrowElem.addEventListener(binding.eventType, (e) => {
                binding.callback( e, [start.id, end.id])
              })
            }
          }
        }
      }
    }
  }
  drawConnection(fromNode, toNode, type, dashed=false) {
    const [fromId, toId] = [fromNode.id, toNode.id]
    console.debug(`Drawing from ${fromId} to ${toId}`)

    const fromElem = document.getElementById(fromId)
    const toElem = document.getElementById(toId)
    const lineColor = this.helpers['connection-color'](type)
    const lineLabel = this.helpers['connection-label'](fromNode, toNode, type)
    // draw a line to the child
    const line = new LinkerLine({
      start: fromElem, 
      end: toElem,
      middleLabel: lineLabel,
      dash: dashed,
      color: lineColor,
    })
    this.lines.push(line)
    return line
  }
  disconnectAll() {
    for (const line of this.lines) {
      line.remove()
    }
    this.lines = []
  }
  addConnectionBinding(eventType, callback) {
    this.connectionBinding = { eventType, callback }
  }
  verify(template, exists=true) {
    if (template && this.templates.includes(template) == exists) {
      return true
    }
  
    console.error(`(nodel) ${!exists ? "found" : "couldn't find"} template #${template}`)
    return false
  }
  // api (pos)
  recenter() {
    self.x = 0
    self.y = 0
  }
  panView(x, y) {
    self.x += x
    self.y += y
  }
  // api (scale)
  adjustScale(delta) {
    this.scale += delta
  }
  setScale(scale) {
  this.scale = scale
  }
  resetScale() {
    this.scale = 1
  }
}
