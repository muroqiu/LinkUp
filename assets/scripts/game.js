/**
 * 连连看主脚本文件
 * 
 * by 慕容秋 muroqiu@qq.com
 * 2018-02-25
 * 
 * 主要的逻辑：
 * A、洗牌 shuffle：遍历图片数组，取1个随机位置的图片和当前位置交换；
 * B、用一个二维数组（各个方向均比图片数组大1）保存图片的状态值，搜索路径时映射到这个数组搜索；
 * C、搜索顺序：
 *    1、同一条直线：判断直线间有无图片；
 *    2、有一个拐角：先定位出两个拐角点，若拐角点没有图片，再转换成一条直线的情况继续处理；
 *    3、两个拐角：某个方向移动，若到达点没有图片，再转换成一个拐角的情况继续处理；若到达点有图片，此方向不再继续搜索；
 */
cc.Class({
    extends: cc.Component,

    properties: {
        imagePrefab: {
            default: null,
            type: cc.Prefab
        },

        spriteframeList: {
            default: [],
            type: [cc.SpriteFrame]
        },

        imageList: {
            default: [],
            type: [cc.node]
        },

        display: {
            default: null,
            type: cc.Label
        },

        ErrorAudio: {
            default: null,
            url: cc.AudioClip
        },

        SuccessAudio: {
            default: null,
            url: cc.AudioClip
        },

        // 行数
        rows: 4,
        // 列数
        columns: 4,
        // 总的图片对数 = lines*rows/2，当为0时，表示已经全部消除 
        pairs: 8,
        // 倒计时
        duration: 20,
        count: 1,
        spriteWidth: 80,
        spriteHeight: 80,
        paddingLeft: 200,
        paddingTop: 120,
        _graphics: {
            default: null,
            type: cc.Graphics
        },
        // 图片状态： 消除
        _TYPE_DELED: -2,
        // 图片状态： 初始化
        _TYPE_INIT: -1,
        // 二维数组，比图片数组大一圈，记录图片状态值
        _canvasGrids: null,
        _lastClickX: -1,
        _lastClickY: -1,
        _isTimerStarted: false,
    },

    // use this for initialization
    /**
     * 系统加载事件
     */
    onLoad: function () {
        this._isTimerStarted = false;
        this.state = 11;
        this.timer = 0;
        this._graphics = this.node.getChildByName("graphics").getComponent(cc.Graphics);
        this._graphics.lineWidth = 5;

        this._canvasGrids = new Array();
        for (var i = 0; i < this.rows + 2; i++) {
            this._canvasGrids[i] = new Array(i);    //在声明二维
            for (var j = 0; j < this.columns + 2; j++) {
                this._canvasGrids[i][j] = -1;
            }
        }

        this.imageList = new Array();
        for (var i = 0; i < this.rows; i++) {
            this.imageList[i] = new Array(i);    //在声明二维
            for (var j = 0; j < this.columns; j++) {
                this.imageList[i][j] = null;
            }
        }

        this.initData();
        this.initMap();

        this.node.getChildByName("refresh").on(cc.Node.EventType.TOUCH_END, function (event) {
            cc.director.loadScene('game');
        });
    },

    /**
     * 初始化数据
     */
    initData: function () {
        for (var row = 0; row < this.rows; row++) {
            for (var column = 0; column < this.columns; column++) {
                var newNode = cc.instantiate(this.imagePrefab);              //复制预制资源
                var index = row * this.rows + column;
                var type = index % this.spriteframeList.length;
                newNode.getComponent(cc.Sprite).spriteFrame = this.spriteframeList[type];
                newNode.getComponent('pic').isempty = false;
                newNode.getComponent('pic').type = type;

                this.imageList[row][column] = newNode;
                // type >= 0，为实际的图片类型值
                this._canvasGrids[row + 1][column + 1] = type;
            }
        }
        this.shuffle();
    },

    /**
     * 洗牌
     */

    shuffle: function () {
        for (var i = this.rows * this.columns - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var x = i % this.rows;
            var y = Math.floor(i / this.rows);
            var x_tmp = j % this.rows;
            var y_tmp = Math.floor(j / this.rows);
            var temp = this.imageList[x][y];
            this.imageList[x][y] = this.imageList[x_tmp][y_tmp];
            this.imageList[x_tmp][y_tmp] = temp;
        }
    },

    /**
     * 初始化
     */
    initMap: function () {
        var self = this;
        for (var row = 0; row < this.rows; row++) {
            for (var column = 0; column < this.columns; column++) {
                var newNode = this.imageList[row][column];
                this.node.addChild(newNode);
                newNode.setPosition(cc.p(this.spriteWidth * row - this.paddingLeft, this.spriteHeight * column - this.paddingTop));
                newNode.getComponent('pic').pointX = row;
                newNode.getComponent('pic').pointY = column;

                newNode.on(cc.Node.EventType.TOUCH_END, function (event) {    //给每个精灵添加监听
                    // 存储第一次点击对象ID
                    if (self._lastClickX == -1 || self._lastClickX == -1) {
                        self._lastClickX = this.getComponent('pic').pointX;
                        self._lastClickY = this.getComponent('pic').pointY;
                    } else if (self._lastClickX == this.getComponent('pic').pointX
                        && self._lastClickY == this.getComponent('pic').pointY) {
                    } else if (self.imageList[self._lastClickX][self._lastClickY].getComponent('pic').type == this.getComponent('pic').type) {     //如果相同图片
                        if (self.isLinked(self._lastClickX, self._lastClickY, this.getComponent('pic').pointX, this.getComponent('pic').pointY)) {    //并且可连通
                            this.getComponent('pic').scheduleOnce(function () {
                                // 这里的 this 指向 component
                                self.clearLinked(self._lastClickX, self._lastClickY, this.pointX, this.pointY);
                                self._lastClickX = -1;
                                self._lastClickY = -1;
                            }, 0.1);
                        } else {
                            // 错误提示  不能连通
                            // cc.warn('错误提示  不能连通   ' + self.imageList[self._lastClickX][self._lastClickY].getComponent('pic').type);
                            // cc.warn('错误提示  不能连通   ' + this.getComponent('pic').type);
                            self._lastClickX = this.getComponent('pic').pointX;
                            self._lastClickY = this.getComponent('pic').pointY;
                            cc.audioEngine.playEffect(self.ErrorAudio, false);
                        }
                    } else {
                        // 错误提示 不是同一张图片
                        // cc.warn('错误提示 不是同一张图片   ' + self.imageList[self._lastClickX][self._lastClickY].getComponent('pic').type);
                        // cc.warn('错误提示 不是同一张图片   ' + this.getComponent('pic').type);
                        self._lastClickX = this.getComponent('pic').pointX;
                        self._lastClickY = this.getComponent('pic').pointY;
                        cc.audioEngine.playEffect(self.ErrorAudio, false);
                    }
                });
            }
        }

    },

    /**
     * 消除已连接
     */
    clearLinked: function (x1, y1, x2, y2) {
        this.imageList[x1][y1].getComponent(cc.Sprite).spriteFrame = null;
        this.imageList[x2][y2].getComponent(cc.Sprite).spriteFrame = null;

        this._canvasGrids[x1 + 1][y1 + 1] = this._TYPE_DELED;
        this._canvasGrids[x2 + 1][y2 + 1] = this._TYPE_DELED;

        cc.audioEngine.playEffect(this.SuccessAudio, false);

        this._graphics.clear();
        this.pairs -= 1;

        if (this.pairs == 0)
            this.gamePass();
    },

    /**
     * 根据矩阵XY获取绝对坐标
     */
    getAbsXY: function (x, y) {
        var absX = 0;
        var absY = 0;
        if (x < 0) {
            absX = this.node.x + this.imageList[0][0].x - this.imageList[0][0].width;
        } else if (x >= this.rows) {
            absX = this.node.x + this.imageList[this.rows - 1][0].x + this.imageList[0][0].width;
        } else {
            absX = this.node.x + this.imageList[x][0].x;
        }
        if (y < 0) {
            absY = this.node.y + this.imageList[0][0].y - this.imageList[0][0].height;
        } else if (y >= this.columns) {
            absY = this.node.y + this.imageList[0][this.columns - 1].y + this.imageList[0][0].height;
        } else {
            absY = this.node.y + this.imageList[0][y].y;
        }

        return [absX, absY];
    },

    /**
     * 是否连通
     */
    isLinked: function (x1, y1, x2, y2) {
        var tmpXY = [];
        var tmpAbsXY = [];

        if (this.matchBlockLine(x1, y1, x2, y2)) {
            // 直线
            tmpAbsXY = this.getAbsXY(x1, y1);
            this._graphics.moveTo(tmpAbsXY[0], tmpAbsXY[1]);
            tmpAbsXY = this.getAbsXY(x2, y2);
            this._graphics.lineTo(tmpAbsXY[0], tmpAbsXY[1]);
            this._graphics.stroke();

            return true;
        } else {
            tmpXY = this.matchBlockCorner(x1, y1, x2, y2, null)
            if (tmpXY) {
                // 一个转角
                tmpAbsXY = this.getAbsXY(x1, y1);
                this._graphics.moveTo(tmpAbsXY[0], tmpAbsXY[1]);
                tmpAbsXY = this.getAbsXY(tmpXY[0], tmpXY[1]);
                this._graphics.lineTo(tmpAbsXY[0], tmpAbsXY[1]);
                tmpAbsXY = this.getAbsXY(x2, y2);
                this._graphics.lineTo(tmpAbsXY[0], tmpAbsXY[1]);
                this._graphics.stroke();

                return true;
            }
            else {
                tmpXY = this.matchBlockUnfold(x1, y1, x2, y2)
                if (tmpXY) {
                    // 两个转角
                    tmpAbsXY = this.getAbsXY(x1, y1);
                    this._graphics.moveTo(tmpAbsXY[0], tmpAbsXY[1]);
                    tmpAbsXY = this.getAbsXY(tmpXY[0], tmpXY[1]);
                    this._graphics.lineTo(tmpAbsXY[0], tmpAbsXY[1]);
                    tmpAbsXY = this.getAbsXY(tmpXY[2], tmpXY[3]);
                    this._graphics.lineTo(tmpAbsXY[0], tmpAbsXY[1]);
                    tmpAbsXY = this.getAbsXY(x2, y2);
                    this._graphics.lineTo(tmpAbsXY[0], tmpAbsXY[1]);
                    this._graphics.stroke();

                    return true;
                }
            }
        }

        return false;
    },

    /**
     * 直连
     */
    matchBlockLine: function (x1, y1, x2, y2) {
        // cc.warn('matchBlock  ' + x1 + ', ' + y1 + '  : ' + x2 + ', ' + y2);
        if (x1 != x2 && y1 != y2) {
            return false;
        }

        if (x1 == x2) {
            // 同一列
            if (x1 < 0 || x1 >= this.rows) {
                return true;
            }
            var Ymin = Math.min(y1, y2) + 1;
            var Ymax = Math.max(y1, y2);
            for (Ymin; Ymin < Ymax; Ymin++) {
                if (this._canvasGrids[x1 + 1][Ymin + 1] > this._TYPE_INIT) {
                    return false;
                }
            }
        } else if (y1 == y2) {
            // 同一行
            if (y1 < 0 || y1 >= this.columns) {
                return true;
            }
            var Xmin = Math.min(x1, x2) + 1;
            var Xmax = Math.max(x1, x2);
            for (Xmin; Xmin < Xmax; Xmin++) {
                if (this._canvasGrids[Xmin + 1][y1 + 1] > this._TYPE_INIT) {
                    return false;
                }
            }
        }

        return true;
    },

    /**
     * 转角逻辑
     */
    matchBlockCorner_point: function (x1, y1, x2, y2, x3, y3) {
        var stMatch = this.matchBlockLine(x1, y1, x3, y3);
        if (stMatch) {
            var tdMatch = this.matchBlockLine(x3, y3, x2, y2);
            if (tdMatch) {
                return [x3, y3];
            }
        }
        return null;
    },

    /**
     * 一个转角
     * 搜索到路径时，返回转角坐标 x3, y3
     */
    matchBlockCorner: function (x1, y1, x2, y2, isAxis_X) {
        // cc.warn('matchBlockCorner  ' + x1 + ', ' + y1 + '  : ' + x2 + ', ' + y2);
        var result;
        // 直连的返回
        if (x1 == x2 || y1 == y2) {
            return null;
        }

        // 转角点1 (x1, y2)，Y方向
        if (this._canvasGrids[x1 + 1][y2 + 1] <= this._TYPE_INIT && isAxis_X != false) {
            result = this.matchBlockCorner_point(x1, y1, x2, y2, x1, y2);
            if (result) {
                return result;
            }
        }

        // 转角点2 (x2, y1)，X方向
        if (this._canvasGrids[x2 + 1][y1 + 1] <= this._TYPE_INIT && isAxis_X != true) {
            result = this.matchBlockCorner_point(x1, y1, x2, y2, x2, y1);
            if (result) {
                return result;
            }
        }

        return null;
    },

    /**
     * 某个方向上的搜索逻辑
     */
    matchBlockUnfold_axis: function (x1, y1, x2, y2, x3, y3, isAxis_X) {
        // cc.warn("matchBlockUnfold_axis  " + x3 + ', ' + y3);
        var tmpXY = [];
        if (this._canvasGrids[x3 + 1][y3 + 1] <= this._TYPE_INIT) {
            tmpXY = this.matchBlockCorner(x3, y3, x2, y2, isAxis_X);
            if (tmpXY) {
                return [x3, y3].concat(tmpXY);;
            }
        }
        return null;
    },

    /**
     * 由中心往外展开搜索路径，某个方向当碰到有图片时，这个方向就不再继续搜索
     * 搜索到路径时，返回两个转角点坐标 x3, y3, x4, y4
     */
    matchBlockUnfold: function (x1, y1, x2, y2) {
        var result;
        var x3 = 0;
        var y3 = 0;
        var canUp = true;
        var canDown = true;
        var canLeft = true;
        var canRight = true;

        // cc.warn('matchBlockUnfold  ' + x1 + ', ' + y1 + '  : ' + x2 + ', ' + y2);
        for (var i = 1; i < this.rows; i++) {
            // 上
            x3 = x1;
            y3 = y1 + i;
            if (canUp && y3 <= this.columns) {
                canUp = this._canvasGrids[x3 + 1][y3 + 1] <= this._TYPE_INIT;
                result = this.matchBlockUnfold_axis(x1, y1, x2, y2, x3, y3, false);
                if (result) {
                    return result;
                }
            }

            // 下
            x3 = x1;
            y3 = y1 - i;
            if (canDown && y3 >= -1) {
                canDown = this._canvasGrids[x3 + 1][y3 + 1] <= this._TYPE_INIT;
                result = this.matchBlockUnfold_axis(x1, y1, x2, y2, x3, y3, false);
                if (result) {
                    return result;
                }
            }

            // 左
            x3 = x1 - i;
            y3 = y1;
            if (canLeft && x3 >= -1) {
                canLeft = this._canvasGrids[x3 + 1][y3 + 1] <= this._TYPE_INIT;
                result = this.matchBlockUnfold_axis(x1, y1, x2, y2, x3, y3, true);
                if (result) {
                    return result;
                }
            }

            // 右
            x3 = x1 + i;
            y3 = y1;
            if (canRight && x3 <= this.rows) {
                canRight = this._canvasGrids[x3 + 1][y3 + 1] <= this._TYPE_INIT;
                result = this.matchBlockUnfold_axis(x1, y1, x2, y2, x3, y3, true);
                if (result) {
                    return result;
                }
            }
        }
        return null;
    },

    /**
     * 游戏结束
     */
    gameOver: function () {
        cc.director.loadScene('gameover');
    },

    /**
     * 过关
     */
    gamePass: function () {
        cc.director.loadScene('gamepass');
    },

    /**
     * 执行倒计时,,, 只有一次生效，后面直接变-1了？
     */
    // procTimer: function () {
    //     var self = this;
    //     // 计时器
    //     // 以秒为单位的时间间隔
    //     var interval = 2;
    //     // 重复次数
    //     var repeat = 20;
    //     // 开始延时
    //     var delay = 1;
    //     this.schedule(function () {
    //         // 这里的 this 指向 component
    //         self.duration -= 1;
    //         self.display.string = self.duration;
    //         if (self.duration = 0) {
    //             self.gameOver();
    //             self.duration = 20;
    //         }
    //     }, interval, repeat, delay);
    // },

    // called every frame, uncomment this function to activate update callback
    /**
     * 系统的更新事件
     */
    update: function (dt) {
        this.timer += dt;

        // 大于已计时秒数
        if (this.timer > this.count) {
            this.display.string = this.duration - this.count;
            if (this.count >= this.duration) {
                this.gameOver();
            }
            this.count += 1;
        }
        // if (!this._isTimerStarted) {
        //     this._isTimerStarted = true;
        //     this.procTimer();
        // }
    },
});


