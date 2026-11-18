'use strict';
async function testWorkspace() {
    const q = s => d.querySelector(s);
    await importJSON(JSON.stringify(Array.from({length: 9}, (_, i) => ({title:'Workspace ' + i,text:'Text '.repeat(20),tags:['work','ideas'],color:'#EAF1F8'}))));
    await reload();
    q('.utilities-menu').open = false;
    for (const width of [1200,1920,768,320]) {
        frame.style.width = width + 'px'; await new Promise(r => setTimeout(r, 80));
        const section = q('.blocks-section').getBoundingClientRect(), card = q('.text-block').getBoundingClientRect();
        check(d.documentElement.scrollWidth <= w.innerWidth, `workspace: no page overflow at ${width}px`);
        if (width >= 1200) check(card.top <= 160 && section.width >= width - 48, `workspace: first row within 160px and nearly full width at ${width}px (top ${card.top}, width ${section.width})`);
        check(['#density-slider','#action-style-button','.appearance-settings','#priority-toggle','#tag-filter'].every(s => q('.blocks-toolbar').contains(q(s))), `workspace: unified toolbar at ${width}px`);
        q('.appearance-settings').open = true;
        const appearance = q('.appearance-panel').getBoundingClientRect();
        check(appearance.left >= 0 && appearance.right <= width, `workspace: Colors panel fits ${width}px`);
        q('.appearance-settings').open = false;
    }
    check(q('#clear-button').closest('details').classList.contains('collection-actions') && q('.app-header').getBoundingClientRect().height <= 48, 'workspace: minimal header and disclosed collection action');
    for (const width of [1200,768,320]) {
        frame.style.width = width + 'px'; await new Promise(r => setTimeout(r, 60));
        click('#connect-four-toggle'); await new Promise(r => setTimeout(r, 80));
        const blocks = q('.blocks-section').getBoundingClientRect(), game = q('#connect-four').getBoundingClientRect();
        check(game.bottom <= blocks.top && !!(q('#connect-four').compareDocumentPosition(q('.blocks-section')) & w.Node.DOCUMENT_POSITION_FOLLOWING), `workspace: game appears before and above blocks at ${width}px`);
        check(d.documentElement.scrollWidth <= w.innerWidth, `workspace: open game fits ${width}px`);
        click('#game-collapse');
    }
    q('.utilities-menu').open = false; frame.style.width = '1200px'; await reload();
}
