/**
 * Created by apple on 2017/7/20.
 */
import { renderInner } from './render'
import { getDOM, getDOMIndex } from './util'

export default class Component {
    constructor(props) {
        this.props = props
    }

    setState(state) {
        setTimeout(() => {
            let shoudUpdate
            if(this.shouldComponentUpdate) {
                shoudUpdate = this.shouldComponentUpdate(this.props, state)
            } else {
                shoudUpdate = true
            }

            shoudUpdate && this.componentWillUpdate && this.componentWillUpdate(this.props, state)
            this.state = Object.assign(this.state, state)

            if (!shoudUpdate) {
                return // do nothing just return
            }

            const vnode = this.render()
            let olddom = getDOM(this)
            const myIndex = getDOMIndex(olddom)
            renderInner(vnode, olddom.parentNode, this, this.__rendered, myIndex)
            this.componentDidUpdate && this.componentDidUpdate()
        }, 0)
    }
}


var a = {
    "nodeName": "div",
    "props": {},
    "children": ["i", {"nodeName": "div", "props": {}, "children": ["am"]}, {
        "nodeName": "div",
        "props": {},
        "children": ["grandson"]
    }]
}

