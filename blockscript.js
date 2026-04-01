class BlockFactors {
    constructor() {
        this.factors = {};
    }

    addFactor(name, value) {
        this.factors[name] = value;
    }

    getFactor(name) {
        return this.factors[name];
    }
}

class BlockRenderer {
    constructor(block) {
        this.block = block;
    }

    render() {
        const element = document.createElement('div');
        element.innerHTML = this.block.content;
        // Bind events, styles, etc.
        return element;
    }
}

class BlockManager {
    constructor() {
        this.blocks = [];
    }

    addBlock(block) {
        const renderer = new BlockRenderer(block);
        this.blocks.push(renderer);
    }

    renderAll() {
        this.blocks.forEach(blockRenderer => {
            document.body.appendChild(blockRenderer.render());
        });
    }
}