var Panel        = require('./Panel');
var addTooltip   = require('./tooltip');
var gridImages   = require('./grid');
var dragManager  = require('./dragManager');
var keyboard     = require('./keyboard');
var helper       = require('./helper');
var assetLoader  = require('../../components/assetLoader');
var Texture      = require('../../components/Texture');
var TileMap      = require('../../components/TileMap');
var inherits     = require('../../components/inherits');
var domUtils     = require('../../components/domUtils');
var resizeHandle = require('./resizeHandle');

var createDom    = domUtils.createDom;
var createDiv    = domUtils.createDiv;
var button       = domUtils.makeButton;

var TILE_WIDTH  = settings.tileSize[0];
var TILE_HEIGHT = settings.tileSize[1];
var PIXEL_SIZE    = settings.PIXEL_SIZE;
var MAP_MAX_UNDO  = 5;


//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄

function MapLayerDropArea(editor, parent, layer) {
	this.dom = createDiv('mapLayerDropArea' + (layer === 'foreground' ? ' mapLayerDropAreaForeground' : ''), parent);
	this.editor = editor;
	this.layer  = layer;
	dragManager.setAsDroppable(this.dom, this);
}

MapLayerDropArea.prototype.onDragEnter = function (id, item) {
	// if (id === 'paletteColor' && this.layer === 'foreground') return;
	this.dom.style.borderColor = '#FF2';
};

MapLayerDropArea.prototype.onDragLeave = function (id, item) {
	this.dom.style.borderColor = '';
};

MapLayerDropArea.prototype.onDragEnd = function (id, item) {
	this.dom.style.borderColor = '';
};

MapLayerDropArea.prototype.drop = function (id, item) {
	if (id !== 'paletteColor' && id !== 'imageFile' && id != 'mapFile') return;
	if (id === 'paletteColor' && this.layer === 'foreground') return;
	this.editor.addLayer(this.layer, item);
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function MapEditorPanel() {
	Panel.call(this, { title: 'map editor' });
	var t = this;

	this.bank  = null; // reference of the maap bank in the asset object
	this.file  = null; // name of the json file of the map bank
	this.mapId = 0;
	this.history = [];
	this.map = new TileMap(0, 0);

	this.viewW = TILE_WIDTH  * 16;
	this.viewH = TILE_HEIGHT * 16;

	var toolbar = createDiv('panelToolbar', this.content);

	this._saved = false;

	this.btnSave = addTooltip(createDiv('panelToolButton', toolbar), 'Save this map');
	this.btnSave.style.backgroundImage = 'url("img/iconSave.png")';
	button(this.btnSave, function saveMap() { t.save(); });

	var btnFlagA = addTooltip(createDiv('panelToolButton', toolbar), 'Flag A');
	btnFlagA.style.backgroundImage = 'url("img/iconFlagA.png")';
	var btnFlagB = addTooltip(createDiv('panelToolButton', toolbar), 'Flag B');
	btnFlagB.style.backgroundImage = 'url("img/iconFlagB.png")';


	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// MAP SETTINGS
	this.settings = createDiv('mapSettings', this.content);
	this.settings.style.display = 'none';
	this.settings.style.width  = this.viewW * PIXEL_SIZE + 1 + 'px';
	this.settings.style.height = this.viewH * PIXEL_SIZE + 1 + 'px';

	createDiv('mapSettingsTitle', this.settings).innerText = 'name';
	var nameInputs = createDiv(null, this.settings);
	this.inputName = createDom('input', 'mapInput', nameInputs);

	createDiv('mapSettingsTitle', this.settings).innerText = 'size';
	var sizeInputs = createDiv(null, this.settings);
	this.inputWidth  = createDom('input', 'mapSizeInput mapInput', sizeInputs);
	createDom('span', null, sizeInputs).innerText = 'x';
	this.inputHeight = createDom('input', 'mapSizeInput mapInput', sizeInputs);

	var okButton = createDiv('mapSettingsButton', this.settings);
	okButton.innerText = 'ok';
	button(okButton, function () {
		var w = ~~(t.inputWidth.value)  || 1;
		var h = ~~(t.inputHeight.value) || 1;
		var name = t.inputName.value;
		t.settings.style.display = 'none';
		if (w === t.map.width && h === t.map.height && t.map.name === name) return;
		t.map.name = name;
		t.resizeMap(w, h);
		t._updateInfos();
		t.save();
	});

	var btnSettings = addTooltip(createDiv('panelToolButton', toolbar), 'Map settings');
	btnSettings.style.backgroundImage = 'url("img/iconMore.png")';
	
	button(btnSettings, function toggleSettingDisplay() {
		var style = t.settings.style;
		style.display = style.display === '' ? 'none' : '';
	});

	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// clear button
	var btnClear = addTooltip(createDiv('panelToolButton', toolbar), 'Clear');
	btnClear.style.backgroundImage = 'url("img/iconClear.png")';
	button(btnClear, function clearMap() {
		t.addHistory();
		t.map.clear();
		t._saved = false;
		t._updateSaveButton();
	});

	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// swap with clipboard
	var btnClear = addTooltip(createDiv('panelToolButton', toolbar), 'Swap with clipboard');
	// btnClear.style.backgroundImage = 'url("img/iconClear.png")';
	button(btnClear, function swapWithClipboard() {
		var mapClipboard = t.toolbox.mapClipboard;
		// TODO: this can be optimized
		var clipboardContent = mapClipboard.copy();
		mapClipboard.resize(t.map.width, t.map.height);
		mapClipboard.paste(t.map);

		t.resizeMap(clipboardContent.width, clipboardContent.height);
		t.map.paste(clipboardContent);

		t._saved = false;
		t._updateSaveButton();
	});

	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// undo button
	var btnUndo = addTooltip(createDiv('panelToolButton', toolbar), 'Undo');
	btnUndo.style.backgroundImage = 'url("img/iconUndo.png")';
	button(btnUndo, function undo() { t.undo(); });

	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// info text
	this.info = createDiv('panelInfos', toolbar);

	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// BACKGROUND & FOREGROUND DROP AREA

	var dropAreas = createDiv('mapDropAreas', this.content);
	dropAreas.style.display = 'none';

	dragManager.on('dragStart', function (id) {
		if (id !== 'imageFile' && id !== 'paletteColor' && id !== 'mapFile') return;
		dropAreas.style.display = '';
		dropAreas.style.width  = t.viewW * PIXEL_SIZE + 'px';
		dropAreas.style.height = t.viewH * PIXEL_SIZE + 'px';
	});

	dragManager.on('dragEnd',   function (id) {
		dropAreas.style.display = 'none';
	});

	new MapLayerDropArea(this, dropAreas, 'background');
	new MapLayerDropArea(this, dropAreas, 'foreground');


	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// MAP RENDER AREA
	var clipSurface = this._clipSurface = createDiv('mapClipSurface', this.content);
	var canvasContainer = createDiv('mapCanvas', this._clipSurface);
	this.resizeViewport();

	var grid = createDiv('mapCanvas mapGrid', canvasContainer);
	grid.style.width  = this.map.width  * TILE_WIDTH  * PIXEL_SIZE + 1 + 'px';
	grid.style.height = this.map.height * TILE_HEIGHT * PIXEL_SIZE + 1 + 'px';
	grid.style.backgroundImage = gridImages.grid;

	this.background = new Texture();
	this.foreground = new Texture();
	var background = this.background.canvas;
	var foreground = this.foreground.canvas;
	var canvas = this.map.texture.canvas;

	foreground.className = background.className = canvas.className = 'mapCanvas';
	canvasContainer.appendChild(background);
	canvasContainer.appendChild(canvas);
	canvasContainer.appendChild(foreground);

	this._grid   = grid;
	this._canvas = canvas;
	this._canvasContainer = canvasContainer;

	var gridEnabled = true;
	keyboard.on('space', function (isPressed) {
		if (!isPressed) return;
		gridEnabled = !gridEnabled;
		grid.style.display = gridEnabled ? '' : 'none';
	});

	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	this._posX = 0;
	this._posY = 0;

	// scroll inside the map
	function startScroll(e) {
		// clipSurface.classList.add('move');

		var startX = e.clientX - t._posX;
		var startY = e.clientY - t._posY;

		function mouseMove(e) {
			e.preventDefault();
			t._posX = helper.clip(e.clientX - startX, -(t.map.width  * TILE_WIDTH  - t.viewW) * PIXEL_SIZE, 0);
			t._posY = helper.clip(e.clientY - startY, -(t.map.height * TILE_HEIGHT - t.viewH) * PIXEL_SIZE, 0);
			canvasContainer.style.left = t._posX + 'px';
			canvasContainer.style.top  = t._posY + 'px';
		}

		function mouseEnd(e) {
			e.preventDefault();
			// clipSurface.classList.remove('move');
			document.removeEventListener('mouseup',   mouseEnd);
			document.removeEventListener('mousemove', mouseMove);
		}

		document.addEventListener('mousemove', mouseMove, false);
		document.addEventListener('mouseup',   mouseEnd,  false);
	}


	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// draw sprite in the map (using selected brush)
	function startDraw(e) {
		var which = e.which;
		var canvasPosition = canvasContainer.getBoundingClientRect();

		var prevX = null;
		var prevY = null;

		var brush = t.toolbox.brush;

		function mouseMove(e, isStart) {
			e.preventDefault();
			var x = ~~((e.clientX - canvasPosition.left) / TILE_WIDTH  / PIXEL_SIZE);
			var y = ~~((e.clientY - canvasPosition.top)  / TILE_HEIGHT / PIXEL_SIZE);
			if (x === prevX && y === prevY) return;
			prevX = x;
			prevY = y;
			isStart && brush.start && brush.start(x, y, t.toolbox, e);
			if (which === 3) {
				brush.erase && brush.erase(x, y, t.toolbox, isStart, e);
			} else {
				brush.draw && brush.draw(x, y, t.toolbox, isStart, e);
			}
		}

		function mouseEnd(e) {
			e.preventDefault();
			document.removeEventListener('mouseup', mouseEnd);
			document.removeEventListener('mousemove', mouseMove);
			brush.end && brush.end(prevX, prevY, t.toolbox, e);
		}

		document.addEventListener('mousemove', mouseMove, false);
		document.addEventListener('mouseup', mouseEnd, false);

		t.addHistory();

		mouseMove(e, true);

		if (t._saved) {
			t._saved = false;
			t._updateSaveButton();
		}
	}

	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	button(canvasContainer, function (e) {
		// if (keyboard.alt) startScroll(e);
		if (e.which === 2) startScroll(e);
		else startDraw(e);
	});

	// disable context menu (right click)
	canvasContainer.oncontextmenu = function () {
		return false;
	};

	this.resizeMap(0, 0);

	// mouse cursor style
	// keyboard.on('shift', function (isPressed) { isPressed ? clipSurface.classList.add('erase') : clipSurface.classList.remove('erase'); });
	// keyboard.on('alt', function (isPressed) { isPressed ? clipSurface.classList.add('move') : clipSurface.classList.remove('move'); });

	//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
	// VIEWPORT RESIZE HANDLE

	function onResizeMove(viewW, viewH, diffX, diffY) {
		t.viewW = viewW + ~~(diffX / PIXEL_SIZE);
		t.viewH = viewH + ~~(diffY / PIXEL_SIZE);
		t.resizeViewport();
	}

	resizeHandle(this, onResizeMove);

}
inherits(MapEditorPanel, Panel);

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
MapEditorPanel.prototype.resizeViewport = function () {
	this.viewW = ~~Math.max(this.viewW, TILE_WIDTH * 16);
	this.viewH = ~~Math.max(this.viewH, TILE_WIDTH * 4);
	this._clipSurface.style.width  = this.viewW * PIXEL_SIZE + 1 + 'px';
	this._clipSurface.style.height = this.viewH * PIXEL_SIZE + 1 + 'px';
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
MapEditorPanel.prototype.resizeMap = function (w, h) {
	this.map.resize(w, h);
	this.background.resize(w * TILE_WIDTH, h * TILE_HEIGHT);
	this.foreground.resize(w * TILE_WIDTH, h * TILE_HEIGHT);

	this._posX = helper.clip(this._posX, -(w * TILE_WIDTH  - this.viewW) * PIXEL_SIZE, 0);
	this._posY = helper.clip(this._posY, -(h * TILE_HEIGHT - this.viewH) * PIXEL_SIZE, 0);
	this._grid.style.width  = w * TILE_WIDTH  * PIXEL_SIZE + 1 + 'px';
	this._grid.style.height = h * TILE_HEIGHT * PIXEL_SIZE + 1 + 'px';
	this._canvasContainer.style.left = this._posX + 'px';
	this._canvasContainer.style.top  = this._posY + 'px';

	var background = this.background.canvas.style;
	var tileground = this._canvas.style;
	var foreground = this.foreground.canvas.style;

	background.width  = foreground.width  = tileground.width  = w * TILE_WIDTH  * PIXEL_SIZE + 'px';
	background.height = foreground.height = tileground.height = h * TILE_HEIGHT * PIXEL_SIZE + 'px';

	// TODO redraw background and foreground if needed

	this.inputWidth.value  = w;
	this.inputHeight.value = h;
	this._saved = false;
	this._updateInfos();
	this._updateSaveButton();
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
MapEditorPanel.prototype.addLayer = function (id, item) {
	if (id !== 'background' && id !== 'foreground') return;
	if (typeof item === 'string') {
		this[id].ctx.fillStyle = item;
		this[id].cls();
	} else {
		this[id].draw(item);
		// TODO save img to redraw on resize
	}
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
MapEditorPanel.prototype._updateInfos = function () {
	this.info.innerText = '#' + this.mapId + ' [' + this.map.width + 'x' + this.map.height + '] ' + this.map.name;
	this.inputName.value = this.map.name;
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
MapEditorPanel.prototype._updateSaveButton = function () {
	this.btnSave.style.backgroundColor = this._saved ? '#FF2' : '#AAA';
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
MapEditorPanel.prototype.save = function () {
	if (this._saved) return;
	var t = this;
	var assetList = this.toolbox.assetList;

	var data = this.map.save();
	var request = {
		command: 'map.save',
		file: this.file,
		mapId: this.mapId,
		data: data
	};
	// send data to the server
	assetLoader.sendRequest(request, function (error) {
		if (error) return alert(error);
		// copy data in maps bank
		// TODO refactor with nicer reference
		if (!t.bank.maps[t.mapId]) {
			t.bank.maps[t.mapId] = {};
			assetList.addMap('maps', t.bank.maps[t.mapId]);
		}
		helper.copyObject(data, t.bank.maps[t.mapId]);

		t._saved = true;
		t._updateSaveButton();
		assetList.refreshAssetList();
	});
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/**
 * @param {Object} params
 *        {string} params.file  - json file name of the bank
 *        {Object} params.bank  - reference to the map bank in the window.assets object
 *        {number} params.index - index of the map in the bank
 */
MapEditorPanel.prototype.loadMap = function (params) {
	this.file  = params.file;
	this.bank  = params.bank;
	this.mapId = params.index;

	var map = this.bank.maps[this.mapId];
	if (!map) return;

	this.resizeMap(map.w, map.h);
	this.map.load(map);
	this._saved = true;
	this._updateSaveButton();
	this._updateInfos();
	this.history = [];

	// if map has a tilesheet, update tilesheet panel
	if (this.map._tilesheetPath) {
		this.toolbox.tilesheet.updateTilesheet(this.map.texture.tilesheet.canvas, true);
	}
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
MapEditorPanel.prototype.addHistory = function () {
	this.history.push(this.map.copy());
	if (this.history.length > MAP_MAX_UNDO) this.history.shift();
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
MapEditorPanel.prototype.undo = function () {
	if (!this.history.length) return;
	this.map.paste(this.history.pop());
	this._saved = false;
	this._updateSaveButton();
};

module.exports = new MapEditorPanel();
