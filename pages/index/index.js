// pages/index/index.js

var timer;
var connect;
Page({
  /**
   * 页面的初始数据
   */
  data: {
    keyName: "Water",
    serviceName: "",
    deviceId: "",
    services: "",
    isConnected: false,
    status: "未连接",
    notifyId: "",
    writeId: "",
    show:false,
    servicelist:[],
    timeStamp:0,
    isHide:false,
    startTime:0

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.initBlue()
  },
  recordtime(){
    var that = this
    timer = setInterval(()=>{
      that.setData({timeStamp:that.data.timeStamp + 1000})
    },1000)
  },
  //处理点击开启事件
  handleBtnClick() {
    if(timer) clearInterval(timer)
    this.setData({show:true,servicelist:[]})
    this.findBlue()
  },
  //关闭弹出层
  onClose(){
    this.setData({show:false})
    if(connect) clearInterval(connect)
  },
  /**
   * 初始化蓝牙设备
   */
  initBlue: function () {
    var that = this;
    wx.openBluetoothAdapter({ //调用微信小程序api 打开蓝牙适配器接口
      success: function (res) {
        // console.log(res)
        wx.showToast({
          title: '初始化成功',
          icon: 'success',
          duration: 800
        })
      },
      fail: function (res) { //如果手机上的蓝牙没有打开，可以提醒用户
        wx.showToast({
          title: '请开启蓝牙',
          icon: 'fails',
          duration: 1000
        })
      }
    })
  },
  /**
   *开始搜索蓝牙设备
   */
  findBlue() {
    var that = this
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      interval: 0,
      success: function (res) {
        connect = setInterval(()=>{
          that.getBlueTooth() //3.0
        },3000)
      }
    })
  },
  /**
   * 获取搜索到的设备信息
   */
  getBlueTooth() {
    var that = this
    wx.getBluetoothDevices({
      success: function (res) {
        const servicelist = res.devices.filter(item=>{
          return item.name.indexOf(that.data.keyName) != -1
        })
        that.setData({servicelist})
        // for (var i = 0; i < res.devices.length; i++) {
        //   if (res.devices[i].name.indexOf(that.data.keyName) != -1 || res.devices[i].localName.indexOf(that.data.keyName) != -1) {
        //     that.setData({
        //       deviceId: res.devices[i].deviceId,
        //       serviceName: res.devices[i].name,
        //     })
        //     // that.connetBlue(res.devices[i].deviceId); //4.0
        //     return;
        //   }
        // }
      },
      fail: function () {
        console.log("搜索蓝牙设备失败")
      }
    })
  },
  //处理选项点击
  handleItemClick(e){
    const deviceId = e.currentTarget.dataset.id
    const serviceName = e.currentTarget.dataset.name
    this.setData({deviceId,serviceName})
    this.connetBlue(deviceId)
  },
  /**
   * 获取到设备之后连接蓝牙设备
   */
  connetBlue(deviceId) {
    var that = this;
    wx.createBLEConnection({
      // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
      deviceId: deviceId, //设备id
      success: function (res) {
        that.setData({show:false})
        wx.showToast({
          title: '连接成功',
          duration: 1000
        })
        if(connect) clearInterval(connect)
        wx.vibrateLong({
          fail:function(res){
            console.log(res)
          }
        })
        that.recordtime()
        that.setData({
          isConnected: true,
          status: "已连接：" + that.data.serviceName
        })
        wx.stopBluetoothDevicesDiscovery({
          success: function (res) {
            console.log('连接蓝牙成功之后关闭蓝牙搜索');
          }
        })
        that.getServiceId() //5.0
      }
    })
  },
  //断开蓝牙连接
  handleClose() {
    var that = this
    const endPayload = new Uint8Array([0xFE, 0xFE, 0x09, 0xB3, 0x00, 0x00]).buffer
    that.sendMy(endPayload,"end")
    wx.closeBLEConnection({
      deviceId: that.data.deviceId,
      success: function () {
        wx.showToast({
          title: '已断开连接',
          duration: 1000
        })
        if(timer) clearInterval(timer)
        that.setData({
          isConnected: false,
          status: "未连接"
        })
      },
      fail: function () {
        wx.showToast({
          title: '断开失败',
          duration: 2000
        })
      }
    })
  },
  //获取服务uuid
  getServiceId() {
    var that = this
    wx.getBLEDeviceServices({
      // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
      deviceId: that.data.deviceId,
      success: function (res) {
        var model = res.services[0]
        that.setData({
          services: model.uuid
        })
        that.getCharacteId() //6.0
      }
    })
  },
  //获取特征id
  getCharacteId() {
    var that = this
    wx.getBLEDeviceCharacteristics({
      // 这里的 deviceId 需要已经通过 createBLEConnection 与对应设备建立链接
      deviceId: that.data.deviceId,
      // 这里的 serviceId 需要在上面的 getBLEDeviceServices 接口中获取
      serviceId: that.data.services,
      success: function (res) {
        for (var i = 0; i < res.characteristics.length; i++) { //2个值
          var model = res.characteristics[i]
          if (model.properties.notify == true) {
            that.setData({
              notifyId: model.uuid //监听的值
            })
          }
          if (model.properties.write == true) {
            that.setData({
              writeId: model.uuid //用来写入的值
            })
          }
          that.sendMy(that.makePayload(that.data.serviceName)) //7.0
        }
      }
    })
  },
  //向蓝牙设备写入值
  sendMy(buffer,status="start") {
    var that = this
    wx.writeBLECharacteristicValue({
      // 这里的 deviceId 需要在上面的 getBluetoothDevices 或 onBluetoothDeviceFound 接口中获取
      deviceId: that.data.deviceId,
      // 这里的 serviceId 需要在上面的 getBLEDeviceServices 接口中获取
      serviceId: that.data.services,
      // 这里的 characteristicId 需要在上面的 getBLEDeviceCharacteristics 接口中获取
      characteristicId: that.data.writeId, //第二步写入的特征值
      // 这里的value是ArrayBuffer类型
      value: buffer,
      success: function (res) {
        status === "start" ?
        wx.showToast({
          title: '开启成功',
        }):wx.showToast({
          title: '成功关闭',
        })
      },
      fail: function (res) {
        status === "end"?
        wx.showToast({
          title: '开启失败',
        }):wx.showToast({
          title: '关闭失败',
        })
        console.log(res)
      }
    })
  },

  //数据处理
  crc16changgong(data) {
    let crc = 0x1017;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x0001) == 1) {
          crc >>= 1;
          crc ^= 0xA001;
        } else crc >>= 1;
      }
    }
    return crc;
  },

  makePayload(deviceName) {
    const checksum = this.crc16changgong(deviceName.slice(-5));
    // prettier-ignore
    return new Uint8Array([
      0xFE, 0xFE, 0x09, 0xB2,
      0x01, checksum & 0xFF, checksum >> 8, 0x00,
      0x70, 0xE2, 0xEB, 0x20,
      0x01, 0x01, 0x00, 0x00,
      0x00, 0x6C, 0x30, 0x00
    ]).buffer;
  },

  //其他周期函数
  onHide(){
    if(timer) clearInterval(timer)
    const startTime = (new Date()).valueOf()
    this.setData({isHide:true,startTime})
  },
  onShow(){
    if(this.data.isHide){
      const endTime = (new Date()).valueOf()
      this.setData({timeStamp:this.data.timeStamp + endTime - this.data.startTime})
      this.setData({isHide:false})
      this.recordtime()
    }
  }
})