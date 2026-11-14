#!/usr/bin/env python3
"""Test-only trace/delay; never used by ordinary acceptance or shipped applications."""
import os,sys,time,json,subprocess
if len(sys.argv)>2 and sys.argv[1]=='simctl':
 parent=subprocess.check_output(['ps','-p',str(os.getppid()),'-o','command='],text=True).strip()
 delay=3 if os.environ.get('VITE183_DELAY')=='1' and sys.argv[2]=='launch' and 'conventions-watch.mjs' not in parent else 0
 with open(os.environ['VITE183_TRACE'],'a') as f:
  f.write(json.dumps({'time':time.time(),'pid':os.getpid(),'parent':os.getppid(),'parentCommand':parent,'delaySeconds':delay,'args':sys.argv[1:]})+'\n')
 if delay:time.sleep(delay)
os.execv('/usr/bin/xcrun',['/usr/bin/xcrun',*sys.argv[1:]])
