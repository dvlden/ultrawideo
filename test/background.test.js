import Storage from '@/helpers/storage'
import Background from '@/extension/background'
import browser from 'sinon-chrome/webextensions'
import manifest from '../src/manifest/index'
import * as defaults from '@/static/defaults'

jest.mock('webextension-polyfill', () => require('sinon-chrome/webextensions'))

describe('test the background', () => {
  beforeAll(() => {
    browser.runtime.getManifest.returns(manifest)
    browser.runtime.getPlatformInfo.returns({
      os: 'mac'
    })

    global.instance = new Background
    instance.data = defaults.settings
    instance.storage = browser.storage.local
    browser.storage.local.get.resolves(defaults.settings)
  })

  afterAll(() => {
    browser.flush()
    delete global.instance
    jest.restoreAllMocks()
  })

  it('should be valid instance', () => {
    expect(instance).toBeInstanceOf(Background)
  })

  describe('test the registerInstallEvent', () => {
    it('should stop execution unless the reason is install', () => {
      const spy = jest.spyOn(instance, 'registerInstallEvent')

      instance.registerInstallEvent()

      browser.runtime.onInstalled.trigger({ reason: 'update' })

      expect(instance.registerInstallEvent).toReturnWith(undefined)

      spy.mockRestore()
    })

    it('should create new tab with url of welcome.html file path', () => {
      const args = {
        url: browser.runtime.getURL('welcome.html')
      }

      instance.registerInstallEvent()
      browser.runtime.onInstalled.trigger({ reason: 'install' })

      expect(browser.tabs.create.calledWith(args)).toBe(true)
    })
  })

  describe('test the registerStorageEvent', () => {
    it('should register storage onChange event', () => {
      instance.registerStorageEvent()

      expect(browser.storage.onChanged.addListener.calledOnce).toBe(true)
    })
  })

  describe('onStorageChange', () => {
    it('should call syncData', () => {
      jest.spyOn(instance, 'syncData')

      instance.onStorageChange({})

      expect(instance.syncData).toHaveBeenCalledTimes(1)
    })

    it('should update the icon to disabled state', async () => {
      await instance.onStorageChange({ pause: { newValue: true }})

      expect(browser.browserAction.setIcon.calledWith({ path: instance.icon.disabled })).toBe(true)
    })

    it('should update the icon to default state', async () => {
      await instance.onStorageChange({ pause: { newValue: false }})

      expect(browser.browserAction.setIcon.calledWith({ path: instance.icon.default })).toBe(true)
    })
  })

  describe('test the registerMessageEvent', () => {
    it('should register event that listens for message', () => {
      instance.registerMessageEvent()

      expect(browser.runtime.onMessage.addListener.calledOnce).toBe(true)
    })
  })

  describe('test the onMessageRequest', () => {
    it('should return false if keystroke is undefined', () => {
      const response = instance.onMessageRequest('N+O+P+E')
      expect(response).toBe(false)
    })

    it('should return true, if keystroke is toggle_pause', () => {
      const response = instance.onMessageRequest(defaults.settings.toggle_pause)
      expect(response).toBe(true)
    })

    it('should return true, if keystroke is toggle_mode', () => {
      const response = instance.onMessageRequest(defaults.settings.toggle_mode)
      expect(response).toBe(true)
    })

    it('should return true, if keystroke is zoomin', () => {
      const response = instance.onMessageRequest('zoomin')
      expect(response).toBe(true)
    })

    it('should return true, if keystroke is zoomout', () => {
      const response = instance.onMessageRequest('zoomout')
      expect(response).toBe(true)
    })

    it('should set new value to storage for pause if keystroke is toggle_pause', () => {
      instance.onMessageRequest(defaults.settings.toggle_pause)

      const args = {
        pause: !instance.data.pause
      }

      expect(browser.storage.local.set.called).toBe(true)
      expect(browser.storage.local.set.calledWith(args)).toBe(true)
    })

    it('should set new value to storage for mode if keystroke is toggle_mode', () => {
      instance.onMessageRequest(defaults.settings.toggle_mode)

      const args = {
        mode: defaults.modesKeys[instance.nextModeId]
      }

      expect(browser.storage.local.set.called).toBe(true)
      expect(browser.storage.local.set.calledWith(args)).toBe(true)
    })

    it('should set new value to storage for mode if keystroke is zoomin', () => {
      instance.onMessageRequest('zoomin')

      const args = {
        mode: defaults.modesKeys[instance.nextModeId]
      }

      expect(browser.storage.local.set.called).toBe(true)
      expect(browser.storage.local.set.calledWith(args)).toBe(true)
    })

    it('should set new value to storage for mode if keystroke is zoomout', () => {
      instance.onMessageRequest('zoomout')

      const args = {
        mode: defaults.modesKeys[instance.nextModeId]
      }

      expect(browser.storage.local.set.called).toBe(true)
      expect(browser.storage.local.set.calledWith(args)).toBe(true)
    })
  })

  describe('test the currentModeId', () => {
    it('should return the index of current mode', () => {
      expect(instance.currentModeId).toBe(1)
    })
  })

  describe('test the modesLength', () => {
    it('should return the length of modes array', () => {
      expect(instance.modesLength).toBe(2)
    })
  })

  describe('test the nextModeId', () => {
    it('should return the index of the next mode' , () => {
      expect(instance.nextModeId).toBe(2)
    })

    it('should return zero if there are no more modes' , () => {
      defaults.modesKeys.pop()
      expect(instance.nextModeId).toBe(0)
    })
  })

  describe('test the previousModeId', () => {
    it('should return the index of the previous mode' , () => {
      expect(instance.previousModeId).toBe(0)
    })

    it('should return zero if there are no more modes' , () => {
      expect(instance.previousModeId).toBe(0)
    })
  })

  describe('test the checkKeystrokeValidity', () => {
    it('should return undefined if given value is not valid', () => {
      const check = instance.checkKeystrokeValidity('N+O+P+E')
      expect(check).toBeUndefined()
    })

    it('should return key by value of given shortcut', () => {
      const togglePause = instance.checkKeystrokeValidity(defaults.settings.toggle_pause)
      expect(defaults.settings).toHaveProperty(togglePause)

      const toggleMode = instance.checkKeystrokeValidity(defaults.settings.toggle_mode)
      expect(defaults.settings).toHaveProperty(toggleMode)
    })
  })

  describe('overrideModeOnAndroidPlatform', () => {
    it('should override mode property in settings if platform is android', async () => {
      browser.runtime.getPlatformInfo.returns({
        os: 'android'
      })

      await instance.overrideModeOnAndroidPlatform()

      expect(defaults.settings.mode).toEqual('normal')
    })
  })
})
