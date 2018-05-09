
window.onload = function(){
    // constant
  
    // variables
	let FPS;
	let eText = document.getElementById('text');

	console.log(navigator.userAgent);
	let browser;
	if (navigator.userAgent.indexOf('Chrome') != -1) {
		browser = 'Chrome';
	} else if (navigator.userAgent.indexOf('Safari')) {
		browser = 'Safari';
	}
	console.log(browser);
	
    // canvasエレメントを取得
    let c = document.getElementById('canvas');
    //c.width = 900;
    //c.height = 540;

	let camMode = 0;
    // webglコンテキストを取得
	let gl = c.getContext('webgl');

    // 頂点シェーダとフラグメントシェーダの生成
    let v_shader = create_shader('vs');
    let f_shader = create_shader('fs');
    let prg = create_program(v_shader, f_shader);
    let attLocation = new Array();
    attLocation[0] = gl.getAttribLocation(prg, 'position');
    attLocation[1] = gl.getAttribLocation(prg, 'textureCoord');
    let attStride = new Array();
    attStride[0] = 3;
    attStride[1] = 2;
    let uniLocation = new Array();
    uniLocation[0] = gl.getUniformLocation(prg, 'color');
    uniLocation[1] = gl.getUniformLocation(prg, 'mvpMatrix');
    uniLocation[2] = gl.getUniformLocation(prg, 'invMatrix');
    uniLocation[3] = gl.getUniformLocation(prg, 'texture');
    uniLocation[4] = gl.getUniformLocation(prg, 'alpha');
    uniLocation[5] = gl.getUniformLocation(prg, 'tex_shift');
    uniLocation[6] = gl.getUniformLocation(prg, 'texMatrix');
    uniLocation[7] = gl.getUniformLocation(prg, 'textureShade');
    uniLocation[8] = gl.getUniformLocation(prg, 'mMatrix');

    gl.useProgram(prg);

	// 各種行列の生成と初期化
    let m = new matIV();
    let vMatrix = m.identity(m.create());
	let pMatrix = m.identity(m.create());
    let p1Matrix = m.identity(m.create());
	let vpoMatrix = m.identity(m.create());//For HUD
    let vpMatrix = m.identity(m.create());
	let mvpMatrix = m.identity(m.create());
	let invMatrix = m.identity(m.create());
	let tMatrix = m.identity(m.create());
	let vTempMatrix = m.identity(m.create());

	let q = new qtnIV();
	
	m.ortho(0.0, 0.02 * c.width, 0.02 * c.height, 0.0, 0.1, 300, vpoMatrix);
	m.translate(vpoMatrix, [0, 0, -20], vpoMatrix);

    const obNames = [
					 'building_01',
					 'building_01_piles',
					 'jetty',
					 'camera',
					 'camera_origin'
					 ];
	
	const obCamera = [
				'camera'
				];
	
	const obLoading = [];
	
	const obResp = [];
	const obHUD = [];
	let objects = new Array();
	let Object = function (name) {
		this.name = name;
	}
	
	let allDataReady = false;
	let numDataReady = 0;
	
	const parentList = readParentList();

	for (let i = 0; i < obNames.length; i++) {
		const ob = new Object(obNames[i]);
		
		ob.texture = new Array();
		
		ob.dataReady = false;
		
		ob.parent = parentList[ob.name];
		
		ob.draw = true;
		
		ob.texture_shift = [0.0, 0.0];
		
		ob.alpha = 1.0;
		
        ob.isHit = false;

        ob.shadow = 0.0;

        objects[ob.name] = ob;
	}
	
	for (let i in objects) {
		readObjectData(objects[i].name);
	}
	
	const acNames = [//object name, speed, phase shift
			   ['camera_origin', 0.02]
			   ];
	
	const actions = new Array();
	
	for (let i = 0; i < acNames.length; i++) {
		actions[acNames[i][0]] = readActionData(acNames[i]);
	}
	
	render();
	
    function render(){
		//gl.clearColor(1.0, 1.0, 0.9, 1.0);
		/*
        // is load ready
        if ((allDataReady === true) && (isInitialize === false)){
            isInitialize = true;
            // 全てのロードが完了した際に一度だけ行いたい処理
        }
		*/
        // アニメーション
        requestAnimationFrame(render);

        if (allDataReady === true) {
			// 全てのリソースのロードが完了している

            // objects の更新
            actionUpdate();
			
			// HUD の更新
			HUDUpdate();
			
			gl.enable(gl.DEPTH_TEST);
			
			cameraUpdate();
			
			// canvasを初期化
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, c.width, c.height);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // objects の描画
            objectRender();
            // hud 関連
            HUDRender();
			
        }else{
            // canvasを初期化
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // リソースのロードが完了していない
            // プログレス表示
            m.multiply(p1Matrix, vMatrix, vpMatrix);
            progressRender();
        }

        gl.flush();
    }

    // camera update
    function cameraUpdate(){
		m.inverse(objects[obCamera[camMode]].mMatrix, vMatrix);
        m.multiply(objects[obCamera[camMode]].pMatrix, vMatrix, vpMatrix);
    }

    // action update
    function actionUpdate(){
        // 全てのリソースを処理する
        for (var i = 0 in objects) {
			//eText.textContent = i;
            // アクションの更新
            if (i in actions && actions[i].objectAction.play != 0) {
				eText.textContent = i;
                objects[i].mMatrix0 = evaluateAction(actions[i].objectAction, actions[i].objectAction.animation_count, objects[i].location, objects[i].rotation, objects[i].scale);
				
				actionIncrement(actions[i].objectAction);
            }
			
			if (i in actions && typeof(actions[i].materialAction) !== 'undefined' && actions[i].materialAction.play != 0) {
				objects[i].alpha = evaluateMaterialAction(actions[i].materialAction, actions[i].materialAction.animation_count).alpha;
				//eText.textContent = objects[i].alpha;
				//actionIncrement(actions[i].materialAction);
			}
			// 特例のあるオブジェクト（drone_body or parent=none）
            var mMatrixLocal = m.identity(m.create());
            if (i == 'mambo_body') {
                //eText.textContent = drone.gMatrix;
                //mMatrixLocal = drone.gMatrix;
				//delayCameraUpdate();
                m.multiply(objects[i].mMatrix0, drone.gMatrix, mMatrixLocal);
			} else if (i === 'camera_follow') {
				m.multiply(objects[i].mMatrix0, camera_follow_gMatrix, mMatrixLocal);
			} else if (i === 'camera_front') {
				m.multiply(objects[i].mMatrix0, camera_front_gMatrix, mMatrixLocal);
            } else {
                m.multiply(objects[i].mMatrix0, mMatrixLocal, mMatrixLocal);
            }
            //m.multiply(objects[i].mMatrix0, mMatrixLocal, mMatrixLocal);
            if (objects[i].parent != 'none') {
                //objects[i].mMatrix0 = transformationMatrix(objects[i].location, objects[i].rotation, objects[i].scale, objects[i].rotation_mode);
                var po = objects[objects[i].parent];
				if (po.dataReady) {
                    m.multiply(po.mMatrix, mMatrixLocal, objects[i].mMatrix);
                    //m.multiply(po.mMatrix, objects[i].mMatrix0, objects[i].mMatrix);
                    //objects[i].mMatrix = m.multiply(po.mMatrix, objects[i].mMatrix, objects[i].mMatrix);
                    //objects[i].mMatrix0 = objects[i].mMatrix;
                }
            } else {
                objects[i].mMatrix = mMatrixLocal;
                //objects[i].mMatrix = objects[i].mMatrix0;
            }
        }
    }
	
	function actionIncrement(ac) {
		if (ac.forward) {
			ac.animation_count += ac.speed;
		} else {
			ac.animation_count -= ac.speed;
		}
		if (ac.animation_count > ac.frame_end) {
			if (ac.play == 1) {
				ac.animation_count = ac.frame_start;
			} else if (ac.play == 2) {
				ac.play = 0;
				ac.animation_count = ac.frame_start;
			} else if (ac.play == 3) {
				ac.play = 0;
				ac.animation_count = ac.frame_end;
			}
		}
		if (ac.animation_count < ac.frame_start) {
			if (ac.play == 1) {
				ac.animation_count = ac.frame_end;
			} else if (ac.play == 2) {
				ac.animation_count = ac.frame_end;
				ac.play = 0;
			} else if (ac.play == 3) {
				ac.play = 0;
				ac.animation_count = ac.frame_start;
			}
		}
	}

    // objects rendering
    function objectRender(){
		// uniform変数にテクスチャを登録
        gl.uniform1i(uniLocation[3], 0);
        gl.uniform1i(uniLocation[7], 6);
        for (var i = 0 in objects) {
            if (
                objects[i].type === 0 &&
                objects[i].draw === true &&
                obHUD.indexOf(i) === -1 &&
                obLoading.indexOf(i) === -1
            ) {
				set_attribute(objects[i].VBOList, attLocation, attStride);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objects[i].iIndex);

                gl.bindTexture(gl.TEXTURE_2D, objects[i].texture[i]);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);

                gl.uniform1f(uniLocation[4], objects[i].isHit ? 0.0 : 1.0);
                gl.uniform2fv(uniLocation[5], objects[i].texture_shift);
                gl.uniform1f(uniLocation[9], objects[i].shadow);
                //m.multiply(vpMatrix, mTempMatrix, mvpMatrix);
                m.multiply(vpMatrix, objects[i].mMatrix, mvpMatrix);

                gl.uniformMatrix4fv(uniLocation[1], false, mvpMatrix);
                gl.uniformMatrix4fv(uniLocation[2], false, invMatrix);
                gl.uniformMatrix4fv(uniLocation[6], false, tMatrix);
                gl.uniformMatrix4fv(uniLocation[8], false, objects[i].mMatrix);

                //gl.drawElements(gl.TRIANGLES, objects[i].numLoop, gl.UNSIGNED_SHORT, 0);
                gl.drawElements(gl.TRIANGLES, objects[i].numLoop, gl.UNSIGNED_SHORT, 0);
            }
        }
        gl.uniform1f(uniLocation[9], 0.0);
    }

    // HUD
    function HUDRender(){
		for (var i = 0 in obHUD) {
			if (objects[obHUD[i]].draw) {
				//console.log(i, obHUD[i]);
				set_attribute(objects[obHUD[i]].VBOList, attLocation, attStride);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objects[obHUD[i]].iIndex);
				
				if (objects[obHUD[i]].down) {
					gl.bindTexture(gl.TEXTURE_2D, objects[obHUD[i]].texture[obHUD[i] + '_down']);
				} else {
					gl.bindTexture(gl.TEXTURE_2D, objects[obHUD[i]].texture[obHUD[i]]);
				}
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
				//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
				
				// uniform変数にテクスチャを登録
				//gl.uniform1f(uniLocation[7], 1.0);
				//gl.uniform1f(uniLocation[5], objects[obHUD[i]].texture_shift);
				gl.uniform2fv(uniLocation[5], objects[obHUD[i]].texture_shift);
				
				m.multiply(vpoMatrix, objects[obHUD[i]].mMatrix, mvpMatrix);
				gl.uniformMatrix4fv(uniLocation[1], false, mvpMatrix);
				gl.uniformMatrix4fv(uniLocation[2], false, invMatrix);
				//gl.uniform1f(uniLocation[4], 1.0);
				gl.uniform1f(uniLocation[4], objects[obHUD[i]].alpha);
				
				gl.drawElements(gl.TRIANGLES, objects[obHUD[i]].numLoop, gl.UNSIGNED_SHORT, 0);
			}
        }
    }

    // プログレス表示
    function progressRender(){
        gl.uniform2fv(uniLocation[5], [0.0, 0.0]);
        for (var i = 0 in obLoading) {
            //eText.textContent = numDataReady + ': ' + obNames.length;
            //if (objects[obLoading[i]].dataReady && objects[obLoading[i]].texture[objects[obLoading[i]].name] && !allDataReady) {
            if (objects[obLoading[i]].dataReady && objects[obLoading[i]].texture[obLoading[i]]) {
                set_attribute(objects[obLoading[i]].VBOList, attLocation, attStride);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objects[obLoading[i]].iIndex);

                gl.bindTexture(gl.TEXTURE_2D, objects[obLoading[i]].texture[obLoading[i]]);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);

                // uniform変数にテクスチャを登録
                //gl.uniform1f(uniLocation[7], 1.0);

                var mTempMatrix = m.identity(m.create());
                if (obLoading[i] == 'progress_bar') {
                    m.scale(mTempMatrix, [numDataReady / (obNames.length * 2), 1, 1], mTempMatrix);
                }
                m.multiply(objects[obLoading[i]].mMatrix, mTempMatrix, mTempMatrix);

                m.multiply(vpoMatrix, mTempMatrix, mvpMatrix);
                gl.uniformMatrix4fv(uniLocation[1], false, mvpMatrix);
                gl.uniformMatrix4fv(uniLocation[2], false, invMatrix);
                gl.uniform1f(uniLocation[4], 1.0);

                gl.drawElements(gl.TRIANGLES, objects[obLoading[i]].numLoop, gl.UNSIGNED_SHORT, 0);
            }
        }
    }

    // シェーダを生成する関数
    function create_shader(id){
        // シェーダを格納する変数
        var shader;
        
        // HTMLからscriptタグへの参照を取得
        var scriptElement = document.getElementById(id);
        
        // scriptタグが存在しない場合は抜ける
        if(!scriptElement){return;}
        
        // scriptタグのtype属性をチェック
        switch(scriptElement.type){
				
				// 頂点シェーダの場合
            case 'x-shader/x-vertex':
                shader = gl.createShader(gl.VERTEX_SHADER);
                break;
                
				// フラグメントシェーダの場合
            case 'x-shader/x-fragment':
                shader = gl.createShader(gl.FRAGMENT_SHADER);
                break;
            default :
                return;
        }
        
        // 生成されたシェーダにソースを割り当てる
        gl.shaderSource(shader, scriptElement.text);
        
        // シェーダをコンパイルする
        gl.compileShader(shader);
        
        // シェーダが正しくコンパイルされたかチェック
        if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
            
            // 成功していたらシェーダを返して終了
            return shader;
        }else{
            
            // 失敗していたらエラーログをアラートする
            alert(gl.getShaderInfoLog(shader));
        }
    }
    
    // プログラムオブジェクトを生成しシェーダをリンクする関数
    function create_program(vs, fs){
        // プログラムオブジェクトの生成
        var program = gl.createProgram();
        
        // プログラムオブジェクトにシェーダを割り当てる
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        
        // シェーダをリンク
        gl.linkProgram(program);
        
        // シェーダのリンクが正しく行なわれたかチェック
        if(gl.getProgramParameter(program, gl.LINK_STATUS)){
			
            // 成功していたらプログラムオブジェクトを有効にする
            gl.useProgram(program);
            
            // プログラムオブジェクトを返して終了
            return program;
        }else{
            
            // 失敗していたらエラーログをアラートする
            alert(gl.getProgramInfoLog(program));
        }
    }
    
    // VBOを生成する関数
    function create_vbo(data){
        // バッファオブジェクトの生成
        var vbo = gl.createBuffer();
        
        // バッファをバインドする
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        
        // バッファにデータをセット
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        
        // バッファのバインドを無効化
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        
        // 生成した VBO を返して終了
        return vbo;
    }
    
    // VBOをバインドし登録する関数
    function set_attribute(vbo, attL, attS){
        // 引数として受け取った配列を処理する
        for(var i in vbo){
			//console.log(i);
            // バッファをバインドする
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo[i]);
            
            // attributeLocationを有効にする
            gl.enableVertexAttribArray(attL[i]);
			//console.log(i, attL[i]);
            
            // attributeLocationを通知し登録する
            gl.vertexAttribPointer(attL[i], attS[i], gl.FLOAT, false, 0, 0);
        }
    }
    
    // IBOを生成する関数
    function create_ibo(data){
        // バッファオブジェクトの生成
        var ibo = gl.createBuffer();
        
        // バッファをバインドする
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        
        // バッファにデータをセット
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);
        
        // バッファのバインドを無効化
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        
        // 生成したIBOを返して終了
        return ibo;
    }

	function create_texture(source, i_source){
		var img = new Image();
		img.onload = function(){
			var tex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			gl.generateMipmap(gl.TEXTURE_2D);
			gl.bindTexture(gl.TEXTURE_2D, null);
			objects[source].texture[i_source] = tex;
			numDataReady += 1;
			allDataReady = checkAllDataReady();
		};
		img.src = './resource/' + i_source + '.png';
	}

	function readObjectData(filePath) { //csvﾌｧｲﾙﾉ相対ﾊﾟｽor絶対ﾊﾟｽ
		var coord = new Array();
		var norm = new Array();
		var uv_coord = new Array();
		var data = new XMLHttpRequest();
		data.open("GET", './resource/' + filePath + '.dat', true); //true:非同期,false:同期
		data.responseType = 'arraybuffer';
		data.send(null);
		
		data.onload = function(e) {
			var arrayBuffer = data.response;
			var dv = new DataView(arrayBuffer);
			var location = [];
			var rotation = [];
			var scale = [];
			var off = 0;
			var ob = objects[filePath];
			
			ob.type = dv.getInt32(off, true); //0:MESH, 8:CAMERA
			off += 4;
			ob.rotation_mode = dv.getInt32(off, true);
			off += 4;
			
			for (var i = 0; i < 3; i++) {
				location.push(dv.getFloat32(off, true));
				off += 4;
			}
			ob.location = location;
			
			var rotation_comp = 4;
			if (ob.rotation_mode != 0) {
				rotation_comp = 3;
			}
			for (var i = 0; i < rotation_comp; i++) {
				rotation.push(dv.getFloat32(off, true));
				off += 4;
			}
			ob.rotation = rotation;
			
			for (var i = 0; i < 3; i++) {
				scale.push(dv.getFloat32(off, true));
				off += 4;
			}
			ob.scale = scale;
			ob.mMatrix0 = transformationMatrix(ob.location, ob.rotation, ob.scale, ob.rotation_mode);//Local coordinate
			ob.mMatrix = transformationMatrix(ob.location, ob.rotation, ob.scale, ob.rotation_mode);//Global coordinate
			
			if (ob.type == 0) {//object type 'MESH'
				ob.numLoop = dv.getInt32(off, true);
				off += 4;
				
				for	(var i = 0; i < ob.numLoop; ++i) {
					for (var j = 0; j < 3; ++ j) {
						coord.push(dv.getFloat32(off, true));
						off += 4;
					}
				}
				
				for	(var i = 0; i < ob.numLoop; ++i) {
					for (var j = 0; j < 2; ++ j) {
						uv_coord.push(dv.getFloat32(off, true));
						off += 4;
					}
				}
				
				var ind = new Array();
				for (var ii = 0; ii < ob.numLoop;++ii) {
					ind.push(ii);
				}
				
				var vPosition     = create_vbo(coord);
				var vTextureCoord = create_vbo(uv_coord);
				ob.VBOList       = [vPosition, vTextureCoord];
				ob.iIndex        = create_ibo(ind);
				
				create_texture(filePath, filePath);
			} else if (ob.type == 8) {//object type 'CAMERA'
				console.log(filePath);
				var _pMatrix = m.identity(m.create());
				ob.camera_type = dv.getInt32(off, true);
				off += 4;
				ob.clip_start = dv.getFloat32(off, true);
				off += 4;
				ob.clip_end = dv.getFloat32(off, true);
				off += 4;
				switch (ob.camera_type) {// 0: PERSP, 1: ORTHO
					case 0: //PERSP
						ob.angle_y = dv.getFloat32(off, true);
						m.perspective(ob.angle_y / 1.0 * 180.0 / Math.PI, c.width / c.height, ob.clip_start, ob.clip_end, _pMatrix);
						break;
					case 1: //ORTHO
						ob.ortho_scale = dv.getFloat32(off, true);
						m.ortho(-ob.ortho_scale * c.width, ob.ortho_scale * c.width, ob.ortho_scale * c.height, -ob.ortho_scale * c.height, ob.clip_start, ob.clip_end, _pMatrix);
						break;
				}
				ob.pMatrix = _pMatrix;
				
				//console.log(objects[filePath]);
			}
			
			objects[filePath].dataReady = true;
			numDataReady += 1;
			allDataReady = checkAllDataReady();
			
		}
	}
	
	function checkAllDataReady() {
		var ready = true;
		for (var i = 0 in objects) {
			if (!objects[i].dataReady) {
				ready = false;
			}
			if (objects[i].type == 0 && !objects[i].texture[i]) {
				ready = false;
			}
		}
		return ready;
	}

	function readActionData(acName) {
		var Co = function (_co) {
			this.x = parseFloat(_co[0]);
			this.y = parseFloat(_co[1]);
		}
		var Point = function () {
			
		}
		var Bezier = function () {
			
		}
		var Action = function () {}
		var Actions = function() {}
		
		let actions = new Actions();
		
		var data = new XMLHttpRequest();
		data.open("GET", './resource/' + acName[0] + '_action.csv', false); //true:非同期,false:同期
		data.send(null);
		
		var LF = String.fromCharCode(10); //改行ｺｰﾄﾞ
		var lines = data.responseText.split(LF);
		var cl = 0
		let numAction = lines[cl++]; //number of actions
		let rM; //rotation mode
		for (var ia = 0; ia < numAction; ia++) {
			let aT = lines[cl++]; //action type
			if (aT === 'object action') {
				rM = parseInt(lines[cl++]);
			}
			let frRange = lines[cl++].split(',');
			let nB = parseInt(lines[cl++]);
			let beziers = [];
			for (var i = 0; i < nB; ++i) {
				var bz = new Bezier();
				bz.data_path = lines[cl];
				bz.array_index = parseInt(lines[cl + 1]);
				bz.keyframe_points = parseInt(lines[cl + 2]);
				cl += 3;
				bz.handles = [];
				for (var j = 0; j < bz.keyframe_points; ++j) {
					var point = new Point();
					point.handle_left = new Co(lines[cl].split(','));
					point.co = new Co(lines[cl + 1].split(','));
					point.handle_right = new Co(lines[cl + 2].split(','));
					bz.handles.push(point);
					cl += 3;
				}
				beziers.push(bz);
			}
			
			var action = new Action();
			if (aT === 'object action') {
				action.rotation_mode = rM;
			}
			action.frame_start = parseFloat(frRange[0]);
			action.frame_end = parseFloat(frRange[1]);
			action.numCurve = nB;
			action.curves = beziers;
			
			if (acName[2]) {
				action.animation_count = acName[2];
			} else {
				//action.animation_count = -1;
				action.animation_count = action.frame_start
			}
			action.speed = acName[1];
			action.play = 1; //0: stop, 1: play loop, 2: play once (return to first frame), 3: play once (stay at last frame)
			action.forward = true;
			
			if (aT === 'object action') {
				actions.objectAction = action;
			} else if (aT === 'material action') {
				actions.materialAction = action;
			}
		}
		//console.log(actions);
		
		return actions;
	}

	function readParentList() {
		var data = new XMLHttpRequest();
		data.open("GET", './resource/parent_list.csv', false); //true:非同期,false:同期
		data.send(null);
		
		var LF = String.fromCharCode(10); //改行ｺｰﾄﾞ
		var lines = data.responseText.split(LF);
		var pList = new Array();
		for (var i = 0 in lines) {
			var a = lines[i].split(',');
			pList[a[0]] = a[1];
		}
		
		return pList;
	}
	
	function evaluateAction(_action, _x, _loc, _rot, _scale) {
		let locVec = _loc.slice();
		let rotVec = _rot.slice();
		let scVec = _scale.slice();
		
		for (var i = 0; i < _action.numCurve; i++) {
			if (_action.curves[i].data_path == 'location') {
				locVec[_action.curves[i].array_index] = bezier2D(_action.curves[i].handles, _x);
			} else if (_action.curves[i].data_path == 'scale') {
				scVec[_action.curves[i].array_index] = bezier2D(_action.curves[i].handles, _x);
			} else if (_action.curves[i].data_path == 'rotation_euler') {
				rotVec[_action.curves[i].array_index] = bezier2D(_action.curves[i].handles, _x);
			} else if (_action.curves[i].data_path == 'rotation_quaternion') {
				rotVec[_action.curves[i].array_index] = bezier2D(_action.curves[i].handles, _x);
			}
		}
		
		return transformationMatrix(locVec, rotVec, scVec, _action.rotation_mode);
	}
	
	function evaluateMaterialAction(_action, _x) {
		let material = function () {
			
		}
		for (var i = 0; i < _action.numCurve; i++) {
			if (_action.curves[i].data_path === 'alpha') {
				material.alpha = bezier2D(_action.curves[i].handles, _x);
			}
		}
		return material;
	}
	
	function transformationMatrix(_loc, _rot, _scale, _rot_mode) {
		var mMatrix = m.identity(m.create());
		
		var mQtn = q.identity(q.create());
		var rMatrix = m.identity(m.create());
		var tMatrix = m.identity(m.create());
		var sMatrix = m.identity(m.create());
		
		switch (_rot_mode) {
			case 0:
				mQtn[0] = _rot[1];
				mQtn[1] = _rot[2];
				mQtn[2] = _rot[3];
				mQtn[3] = _rot[0];
				q.inverse(mQtn, mQtn);
				q.toMatIV(mQtn, rMatrix);
				break;
			case 1://XYZ
				m.rotate(rMatrix, _rot[0], [1, 0, 0], rMatrix);
				m.rotate(rMatrix, _rot[1], [0, 1, 0], rMatrix);
				m.rotate(rMatrix, _rot[2], [0, 0, 1], rMatrix);
				break;
			case 2://XZY
				m.rotate(rMatrix, _rot[0], [1, 0, 0], rMatrix);
				m.rotate(rMatrix, _rot[2], [0, 0, 1], rMatrix);
				m.rotate(rMatrix, _rot[1], [0, 1, 0], rMatrix);
				break;
			case 3://YXZ
				m.rotate(rMatrix, _rot[1], [0, 1, 0], rMatrix);
				m.rotate(rMatrix, _rot[0], [1, 0, 0], rMatrix);
				m.rotate(rMatrix, _rot[2], [0, 0, 1], rMatrix);
				break;
			case 4://YZX
				m.rotate(rMatrix, _rot[1], [0, 1, 0], rMatrix);
				m.rotate(rMatrix, _rot[2], [0, 0, 1], rMatrix);
				m.rotate(rMatrix, _rot[0], [1, 0, 0], rMatrix);
				break;
			case 5://ZXY
				m.rotate(rMatrix, _rot[2], [0, 0, 1], rMatrix);
				m.rotate(rMatrix, _rot[0], [1, 0, 0], rMatrix);
				m.rotate(rMatrix, _rot[1], [0, 1, 0], rMatrix);
				break;
			case 6://ZYX
				m.rotate(rMatrix, _rot[2], [0, 0, 1], rMatrix);
				m.rotate(rMatrix, _rot[1], [0, 1, 0], rMatrix);
				m.rotate(rMatrix, _rot[0], [1, 0, 0], rMatrix);
				break;
		}
		
		m.translate(tMatrix, _loc, tMatrix);
		m.scale(sMatrix, _scale, sMatrix);
		
		m.multiply(tMatrix, sMatrix, mMatrix);
		m.multiply(mMatrix, rMatrix, mMatrix);
		return mMatrix;
	}

	function bezier2D(_handles, _x) {
		if ((_handles[0].co.x > _x) || (_handles[_handles.length - 1].co.x < _x)) {
			return null;
		} else {
			for (var ir = 0 in _handles) {
				if (_handles[ir].co.x > _x) {
					break;
				}
			}
			ir -= 1;
			var cp = [_handles[ir].co, _handles[ir].handle_right, _handles[ir + 1].handle_left, _handles[ir + 1].co];
			var t = (_x - cp[0].x) / (cp[3].x - cp[0].x);
			var delta = (t > 0.5) ? (1.0 - t) * 0.5 : t * 0.5;
			var pdif;
			var dif = 0.5;
			var n = 0;
			var ae = 0.0001;
			while (Math.abs(dif) > ae) {
				pdif = dif;
				dif = _x - (
							 cp[0].x * (1.0 - t) * (1.0 - t) * (1.0 - t)
							 + 3.0 * cp[1].x * t * (1.0 - t) * (1.0 - t)
							 + 3.0 * cp[2].x * t * t * (1.0 - t)
							 + cp[3].x * t * t * t
							 );
				if (dif * pdif < 0) {
					delta *= 0.5;
				}
				if (dif > ae) {
					t += delta;
				} else if (dif < -ae) {
					t -= delta;
				}
				n += 1;
			}
			var y = cp[0].y * (1.0 - t) * (1.0 - t) * (1.0 - t)
			+ 3.0 * cp[1].y * t * (1.0 - t) * (1.0 - t)
			+ 3.0 * cp[2].y * t * t * (1.0 - t)
			+ cp[3].y * t * t * t;
			
			return y;
		}
		
	}
	
	function HUDUpdate(){
	}

};
