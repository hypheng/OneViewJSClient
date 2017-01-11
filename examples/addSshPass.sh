dcs_vm_pwd="hponeview"
sshpass="/usr/bin/sshpass"

for appliance in $@; do
  echo "add ssh pass to $appliance"
  $sshpass -p $dcs_vm_pwd ssh -oStrictHostKeyChecking=no $appliance echo 2> /dev/null
  $sshpass -p $dcs_vm_pwd ssh-copy-id $appliance 2> /dev/null
  echo "done"
done
