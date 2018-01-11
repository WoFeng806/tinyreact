# 从0实现一个tiny react（二）
ui = f(d)！ 这是react考虑ui的方式，开发者可以把重心放到d 数据上面来了。 从开发者的角度来讲 d一旦改变，react将会把ui重新渲染，使其再次满足
ui = f(d), 开发者没有任何dom操作， 交给react就好！！

怎么重新渲染呢？ (一)文 中我们实现了一种方式， state改变的时候，用新的dom树替换一下老的dom树， 这是完全可行的。
考虑一下这个例子 [在线演示地址](http://jsfiddle.net/yankang/z0e9ngwL/): 
```javascript 1.7
class AppWithNoVDOM extends Component {
    constructor(props) {
        super(props)
    }

    testApp3() {
        let result = []
        for(let i = 0; i < 10000 ; i++) {
            result.push(<div style={{
                width: '30px',
                color: 'red',
                fontSize: '12px',
                fontWeight: 600,
                height: '20px',
                textAlign: 'center',
                margin:'5px',
                padding: '5px',
                border:'1px solid red',
                position: 'relative',
                left: '10px',
                top: '10px',
            }} title={i} >{i}</div>)
        }
        return result
    }

    render() {
        return (
            <div
                width={100}>
                <a  onClick={e => {
                    this.setState({})
                }}>click me</a>
                {this.testApp3()}
            </div>
        )
    }
}

const startTime = new Date().getTime()
render(<App/>, document.getElementById("root"))
console.log("duration:", new Date().getTime() - startTime)


...
setState(state) {
    setTimeout(() => {
        this.state = state
        const vnode = this.render()
        let olddom = getDOM(this)
        const startTime = new Date().getTime()
        render(vnode, olddom.parentNode, this, olddom)
        console.log("duration:", new Date().getTime() - startTime)
    }, 0)
}
...
```
我们在 render, setState 设置下时间点。 在10000万个div的情况下， 第一次render和setState触发的render 耗时大概在180ms （可能跟机器配置有关）
当点击的时候， 由于调用`this.setState({})`, 页面将会重新渲染， 再次建立10000万个div， 但是实际上这里的DOM一点也没改。
应用越复杂， 无用功越多，卡顿越明显

为了解决这个问题， react提出了virtual-dom的概念：vnode(纯js对象) '代表' dom， 在渲染之前， 先比较出oldvnode和newvode的 区别。 然后增量的
更新dom。 virtual-dom 使得ui=f(d) 得以在实际项目上使用。 
（注意： virtual-dom 并不会加快应用速度， 只是让应用在不直接操作dom的情况下，通过暴力的比较，增量更新 让应用没有那么慢）

如何增量更新呢？
### 复用DOM
回想一下, 在 [(一)](https://segmentfault.com/a/1190000010822571) render函数 里面对于每一个判定为 dom类型的VDOM， 是直接创建一个新的DOM：
```javascript 1.7
...
else if(typeof vnode.nodeName == "string") {
    dom = document.createElement(vnode.nodeName)
    ...
} 
...
```
一定要创建一个  新的DOM 结构吗？<br/>
考虑这种情况：假如一个组件， 初次渲染为 renderBefore， 调用setState再次渲染为 renderAfter  调用setState再再次渲染为 renderAfterAfter。 VNODE如下
```javascript 1.7
const renderBefore = {
    tagName: 'div',
    props: {
        width: '20px',
        className: 'xx'
    },
    children:[vnode1, vnode2, vnode3]
}
const renderAfter = {
    tagName: 'div',
    props: {
        width: '30px',
        title: 'yy'
    },
    children:[vnode1, vnode2]
}
const renderAfterAfter = {
    tagName: 'span',
    props: {
        className: 'xx'
    },
    children:[vnode1, vnode2, vnode3]
}
```
renderBefore 和renderAfter 都是div， 只不过props和children有部分区别，那我们是不是可以通过修改DOM属性， 修改DOM子节点，把 rederBefore 变化为renderAfter呢？， 这样就避开了DOM创建。 而 renderAfter和renderAfterAfter
属于不同的DOM类型， 浏览器还没提供修改DOM类型的Api，是无法复用的， 是一定要创建新的DOM的。

原则如下： 
  * 不同元素类型是无法复用的， span 是无法变成 div的。  
  * 对于相同元素: 
     * 更新属性， 
     * 复用子节点。

所以，现在的代码可能是这样的：
```javascript 1.7
...
else if(typeof vnode.nodeName == "string") {
    if(!olddom || olddom.nodeName != vnode.nodeName.toUpperCase()) {
        createNewDom(vnode, parent, comp, olddom)
    } else {
        diffDOM(vnode, parent, comp, olddom) // 包括 更新属性， 子节点复用
    }
}
...
``` 
#### 更新属性
对于 renderBefore => renderAfter 。 属性部分需要做3件事情。 
1. renderBefore 和 renderAfter 的属性交集  如果值不同， 更新值 updateAttr
2. renderBefore 和 renderAfter 的属性差集  置空  removeAttr
3. renderAfter 和 renderBefore 的属性差集  设置新值 setAttr
```javascript 1.7
const {onlyInLeft, bothIn, onlyInRight} = diffObject(newProps, oldProps)
setAttrs(olddom, onlyInLeft)
removeAttrs(olddom, onlyInRight)
diffAttrs(olddom, bothIn.left, bothIn.right)

function diffObject(leftProps, rightProps) {
    const onlyInLeft = {}
    const bothLeft = {}
    const bothRight = {}
    const onlyInRight = {}

    for(let key in leftProps) {
        if(rightProps[key] === undefined) {
            onlyInLeft[key] = leftProps[key]
        } else {
            bothLeft[key] = leftProps[key]
            bothRight[key] = rightProps[key]
        }
    }

    for(let key in rightProps) {
        if(leftProps[key] === undefined) {
            onlyInRight[key] = rightProps[key]
        }
    }

    return {
        onlyInRight,
        onlyInLeft,
        bothIn: {
            left: bothLeft,
            right: bothRight
        }
    }
}

function setAttrs(dom, props) {
    const allKeys = Object.keys(props)
    allKeys.forEach(k => {
        const v = props[k]

        if(k == "className") {
            dom.setAttribute("class", v)
            return
        }

        if(k == "style") {
            if(typeof v == "string") {
                dom.style.cssText = v //IE
            }

            if(typeof v == "object") {
                for (let i in v) {
                    dom.style[i] =  v[i]
                }
            }
            return

        }

        if(k[0] == "o" && k[1] == "n") {
            const capture = (k.indexOf("Capture") != -1)
            dom.addEventListener(k.substring(2).toLowerCase(), v, capture)
            return
        }

        dom.setAttribute(k, v)
    })
}

function removeAttrs(dom, props) {
    for(let k in props) {
        if(k == "className") {
            dom.removeAttribute("class")
            continue
        }

        if(k == "style") {
            dom.style.cssText = "" //IE
            continue
        }


        if(k[0] == "o" && k[1] == "n") {
            const capture = (k.indexOf("Capture") != -1)
            const v = props[k]
            dom.removeEventListener(k.substring(2).toLowerCase(), v, capture)
            continue
        }

        dom.removeAttribute(k)
    }
}

/**
 *  调用者保证newProps 与 oldProps 的keys是相同的
 * @param dom
 * @param newProps
 * @param oldProps
 */
function diffAttrs(dom, newProps, oldProps) {
    for(let k in newProps) {
        let v = newProps[k]
        let ov = oldProps[k]
        if(v === ov) continue

        if(k == "className") {
            dom.setAttribute("class", v)
            continue
        }

        if(k == "style") {
            if(typeof v == "string") {
                dom.style.cssText = v
            } else if( typeof v == "object" && typeof ov == "object") {
                for(let vk in v) {
                    if(v[vk] !== ov[vk]) {
                        dom.style[vk] = v[vk]
                    }
                }

                for(let ovk in ov) {
                    if(v[ovk] === undefined){
                        dom.style[ovk] = ""
                    }
                }
            } else {  //typeof v == "object" && typeof ov == "string"
                dom.style = {}
                for(let vk in v) {
                    dom.style[vk] = v[vk]
                }
            }
            continue
        }

        if(k[0] == "o" && k[1] == "n") {
            const capture = (k.indexOf("Capture") != -1)
            let eventKey = k.substring(2).toLowerCase()
            dom.removeEventListener(eventKey, ov, capture)
            dom.addEventListener(eventKey, v, capture)
            continue
        }

        dom.setAttribute(k, v)
    }
}
```
'新'的dom结构 属性和  renderAfter对应了。<br/>
但是 children部分 还是之前的
#### 操作子节点
之前 操作子节点的代码： 
```javascript 1.7
for(let i = 0; i < vnode.children.length; i++) {
    render(vnode.children[i], dom, null, null)
}
```
render 的第3个参数comp '谁渲染了我'， 第4个参数olddom '之前的旧dom元素'。现在复用旧的dom， 所以第4个参数可能是有值的 代码如下： 
```javascript 1.7
let olddomChild = olddom.firstChild
for(let i = 0; i < vnode.children.length; i++) {
    render(vnode.children[i], olddom, null, olddomChild)
    olddomChild = olddomChild && olddomChild.nextSibling
}

//删除多余的子节点
while (olddomChild) {
    let next = olddomChild.nextSibling
    olddom.removeChild(olddomChild)
    olddomChild = next
}
```

综上所述  完整的diffDOM 如下：
```javascript 1.7
function diffDOM(vnode, parent, comp, olddom) {
    const {onlyInLeft, bothIn, onlyInRight} = diffObject(vnode.props, olddom.__vnode.props)
    setAttrs(olddom, onlyInLeft)
    removeAttrs(olddom, onlyInRight)
    diffAttrs(olddom, bothIn.left, bothIn.right)


    let olddomChild = olddom.firstChild
    for(let i = 0; i < vnode.children.length; i++) {
        render(vnode.children[i], olddom, null, olddomChild)
        olddomChild = olddomChild && olddomChild.nextSibling
    }

    while (olddomChild) { //删除多余的子节点
        let next = olddomChild.nextSibling
        olddom.removeChild(olddomChild)
        olddomChild = next
    }
    olddom.__vnode = vnode  
}
```
由于需要在diffDOM的时候 从olddom获取 oldVNODE（即 diffObject(vnode.props, olddom.__vnode.props)）。 所以：
```javascript 1.7
// 在创建的时候
...
let dom = document.createElement(vnode.nodeName)
dom.__vnode = vnode
...


// diffDOM
...
const {onlyInLeft, bothIn, onlyInRight} = diffObject(vnode.props, olddom.__vnode.props)
...
olddom.__vnode = vnode  // 更新完之后， 需要把__vnode的指向 更新
...
```
另外 对于 TextNode的复用:
```javascript 1.7
...
if(typeof vnode == "string" || typeof vnode == "number") {
        if(olddom && olddom.splitText) {
            if(olddom.nodeValue !== vnode) {
                olddom.nodeValue = vnode
            }
        } else {
            dom = document.createTextNode(vnode)
            if(olddom) {
                parent.replaceChild(dom, olddom)
            } else {
                parent.appendChild(dom)
            }
        }
    }
...
```
重新 跑一下开头 的例子 [新的复用DOM演示](http://jsfiddle.net/yankang/cyc4ss5c/) setState后渲染时间变成了 20ms 左右。 从 180ms 到20ms 差不多快有一个数量级的差距了。 
到底快了多少，取决于前后结构的相似程度， 如果前后结构基本相同，diff是有意义的减少了DOM操作。

#### 复用子节点 - **key**
```javascript 1.7
初始渲染
...
render() {
    return (
        <div>
            <WeightCompA/>
            <WeightCompB/>
            <WeightCompC/>
        </div>
    )
}
...

setState再次渲染
...
render() {
    return (
        <div>
            <span>hi</span>
            <WeightCompA/>
            <WeightCompB/>
            <WeightCompC/>
        </div>
    )
}
...
```
我们之前的子节点复用顺序就是按照DOM顺序， 显然这里如果这样处理的话， 可能导致组件都复用不了。 针对这个问题， React是通过给每一个子组件提供一个 "key"属性来解决的
对于拥有 同样key的节点， 认为结构相同。 所以问题变成了：
```
f([{key: 'wca'}, {key: 'wcb}, {key: 'wcc}]) = [{key:'spanhi'}, {key: 'wca'}, {key: 'wcb}, {key: 'wcc}]
```
函数f 通过删除， 插入操作，把olddom的children顺序， 改为和 newProps里面的children一样 （按照key值一样）。类似与 [字符串距离](https://en.wikipedia.org/wiki/Edit_distance),
对于这个问题， 我将会另开一篇文章

### 总结
通过 diff 比较渲染前后 DOM的差别来复用实际的， 我们的性能得到了提高。现在 render方法的描述： <br/>
render 方法是根据的vnode， 渲染到实际的dom，如果存在olddom会先尝试复用的 一个递归方法 (由于组件 最终一定会render html的标签。 所以这个递归一定是能够正常返回的)
   * vnode是字符串， 如果存在olddom， 且可以复用， 复用之。否则创建textNode节点
   * 当vnode.nodeName是 字符串的时候， 如果存在olddom， 且可以复用， 复用之。否则创建dom节点， 根据props设置节点属性， 遍历render children
   * 当vnode.nodeName是 function的时候， 获取render方法的返回值 vnode'， 执行render(vnode')
   
[本文代码git地址](https://github.com/ykforerlang/tinyreact)



   
 