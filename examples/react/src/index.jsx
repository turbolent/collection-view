
import { CollectionView, GridLayout } from '../../../dist'
import style from '../../_common/style.css'
import * as React from "react";
import ReactDOM from 'react-dom';
import { diff, Deletion, Insertion, Update, Move } from 'heckel-diff-items'

const initialItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const changedItems = [1, 15, 16, 3, 6, 8, 4, 10, 11, 12, 13, 14]

class Item extends React.Component {
    render() {
        const {item} = this.props;
        return <span>Item: {item}</span>
    }
}

class Content extends React.Component {

    constructor(props) {
        super(props)

        // NOTE: *not* using state
        this.items = props.items
    }

    getCount() {
        return this.items.length
    }

    configureElement(element, index) {
        element.classList.add(style.box)
        const item = this.items[index]
        // render item using React
        ReactDOM.render(<Item item={item} />, element)
    }

    installView(element) {
        const layout = new GridLayout()
        this.view = new CollectionView(element, layout, this)
    }

    uninstallView() {
        if (!this.view) {
            return
        }

        this.view.uninstall((element => {
            // elements were rendered using React, clean up
            ReactDOM.unmountComponentAtNode(element)
        }))
    }

    onRef = (element) => {
        if (!element) {
            this.uninstallView()
            return
        }

        this.installView(element)
    }

    update(items) {
        const oldItems = this.items
        this.items = items

        // can't update if the view isn't installed yet
        if (!this.view) {
            return
        }

        const ops = diff(oldItems, items)

        const removed = []
        const added = []
        const moved = new Map()

        ops.forEach((op) => {
            if (op instanceof Deletion) {
                removed.push(op.index)
            } else if (op instanceof Insertion) {
                added.push(op.index)
            }  else if (op instanceof Move) {
                moved.set(op.fromIndex, op.toIndex)
            } else if (op instanceof Update) {
                removed.push(op.index)
                added.push(op.index)
            }
        })

        console.log(JSON.stringify([removed, added, Array.from(moved.entries())]))

        this.view.changeIndices(removed, added, moved)
    }

    shouldComponentUpdate() {
        // prevent component from re-rendering
        return false
    }

    componentWillReceiveProps(nextProps) {
        // manually update
        this.update(nextProps.items)
    }

    componentWillUnmount() {
        this.uninstallView()
    }

    render() {
        return (
            <div id="wrapper">
                <div id="scroll" ref={this.onRef}>
                </div>
            </div>
        )
    }
}

class Example extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            changed: false,
            hidden: false
        }
    }

    onChangeClick = () => {
        this.setState((prevState) => ({
            changed: !prevState.changed
        }))
    }

    onHideClick = () => {
        this.setState((prevState) => ({
            hidden: !prevState.hidden
        }))
    }

    render() {
        const {changed, hidden} = this.state
        const items = changed
            ? changedItems
            : initialItems

        // hidden = true will trigger Content's componentWillUnmount

        return [
            <div id="navigation" key="navigation">
                <button onClick={this.onChangeClick}>Change data</button>
                <button onClick={this.onHideClick}>{hidden ? "Show" : "Hide"} view</button>
            </div>,
            <div id="content" key="content">
                {hidden ? undefined : <Content items={items} />}
            </div>
        ]
    }
}

window.onload = function () {
    ReactDOM.render(<Example />, document.body)
}
